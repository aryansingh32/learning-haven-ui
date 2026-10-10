import { renderCertificatePdf } from '../learning/services/certificateRenderer';
import { CertificateTemplatesService } from '../learning/services/certificateTemplates.service';
import { supabase } from '../../config/database';
import logger from '../../config/logger';
import { sendCertificateEmail } from '../communication/services/email.service';

export class ApprenticeshipCertificatesService {
  static async generateCertificate(enrollmentId: string) {
    const { data: enrollment, error } = await supabase
      .from('apprenticeship_enrollments')
      .select(`
        *,
        apprenticeship_programs (*),
        users:user_id (full_name, email),
        apprenticeship_project_progress (status, best_code_quality_score)
      `)
      .eq('id', enrollmentId)
      .single();

    if (error || !enrollment) {
      throw new Error('Enrollment not found');
    }

    const allPassed = (enrollment.apprenticeship_project_progress || []).every((row: any) => row.status === 'passed');
    if (!allPassed) {
      throw new Error('Certificate cannot be issued until all projects are passed');
    }

    const qualityScores = (enrollment.apprenticeship_project_progress || [])
      .map((row: any) => row.best_code_quality_score)
      .filter((value: number | null) => typeof value === 'number');

    const avgCodeQualityScore = qualityScores.length
      ? Number((qualityScores.reduce((sum: number, value: number) => sum + value, 0) / qualityScores.length).toFixed(2))
      : 75;

    const finalGrade = avgCodeQualityScore >= 85 ? 'Distinction' : avgCodeQualityScore >= 70 ? 'Merit' : 'Pass';
    const verificationCode = await this.createVerificationCode(enrollment.apprenticeship_programs?.slug || 'LH', enrollmentId);
    const pdfBytes = await this.buildPdf({
      recipientName: enrollment.users?.full_name || 'Learning Haven Student',
      programTitle: enrollment.apprenticeship_programs?.title || 'Apprenticeship Program',
      issuedAt: new Date().toISOString(),
      finalGrade,
      verificationCode,
    });

    let pdfUrl: string | null = null;
    try {
      const path = `${verificationCode}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(path, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (!uploadError) {
        const { data: publicUrl } = supabase.storage.from('certificates').getPublicUrl(path);
        pdfUrl = publicUrl.publicUrl;
      }
    } catch (storageError: any) {
      logger.error('Error:', storageError);
      logger.warn('Certificate upload skipped:', storageError);
    }

    const { data: certificate, error: certificateError } = await supabase
      .from('apprenticeship_certificates')
      .insert({
        enrollment_id: enrollment.id,
        user_id: enrollment.user_id,
        program_id: enrollment.program_id,
        verification_code: verificationCode,
        recipient_name: enrollment.users?.full_name || 'Learning Haven Student',
        final_grade: finalGrade,
        avg_code_quality_score: avgCodeQualityScore,
        projects_completed: enrollment.completed_projects || enrollment.total_projects,
        certificate_url: pdfUrl,
        pdf_url: pdfUrl,
        social_share_image_url: null,
      })
      .select()
      .single();

    if (certificateError) {
      if (certificateError.code === '23505') {
        const { data: existing } = await supabase
          .from('apprenticeship_certificates')
          .select('*')
          .eq('enrollment_id', enrollment.id)
          .single();

        return existing;
      }

      throw certificateError;
    }

    await supabase
      .from('apprenticeship_enrollments')
      .update({
        certificate_issued: true,
        certificate_id: certificate.id,
      })
      .eq('id', enrollment.id);

    await supabase.from('apprenticeship_events').insert({
      user_id: enrollment.user_id,
      session_id: `certificate:${certificate.id}`,
      event_type: 'certificate_issued',
      event_category: 'certificate',
      event_data: {
        certificate_id: certificate.id,
        verification_code: verificationCode,
        final_grade: finalGrade,
      },
      enrollment_id: enrollment.id,
      project_id: null,
      submission_id: null,
    });

    if (enrollment.users?.email) {
      await sendCertificateEmail({
        to: enrollment.users.email,
        name: enrollment.users.full_name || 'Student',
        programTitle: enrollment.apprenticeship_programs?.title || 'Apprenticeship Program',
        grade: finalGrade,
        verificationCode,
        certificateUrl: pdfUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/certificates/${verificationCode}`,
        pdfUrl,
      });
    }

    return certificate;
  }

  private static async createVerificationCode(programSlug: string, enrollmentId: string) {
    const year = new Date().getFullYear();
    const programCode = programSlug.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 5) || 'APPR';
    const sequence = enrollmentId.replace(/-/g, '').slice(-6).toUpperCase();
    return `LH-${year}-${programCode}-${sequence}`;
  }

  private static async buildPdf(input: {
    recipientName: string;
    programTitle: string;
    issuedAt: string;
    finalGrade: string;
    verificationCode: string;
  }) {
    // Drawn from the apprenticeship default template (Forge admin → Certificates → Templates).
    const template = await CertificateTemplatesService.forCertificate('apprenticeship');
    return Buffer.from(await renderCertificatePdf(template.layout, {
      name: input.recipientName, achievement: input.programTitle, issuedAt: new Date(input.issuedAt),
      code: input.verificationCode, grade: input.finalGrade,
      verifyUrl: `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '')}/certificates/${input.verificationCode}`,
    }));
  }
}
