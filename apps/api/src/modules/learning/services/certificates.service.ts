import { supabase } from '../../../config/database';
import { CacheService } from '../../core/services/cache.service';
import logger from '../../../config/logger';
import { pool } from '../../../config/database';
import { renderCertificatePdf } from './certificateRenderer';
import { CertificateTemplatesService, verifyUrlFor } from './certificateTemplates.service';

export class CertificatesService {
    /**
     * Generate a certificate for completing a topic
     */
    static async generateCertificate(userId: string, topic: string) {
        try {
            // Check if user already has certificate for this topic
            const { data: existing } = await supabase
                .from('certificates')
                .select('id, certificate_url, verification_code')
                .eq('user_id', userId)
                .eq('topic', topic)
                .single();

            if (existing) {
                return {
                    id: existing.id,
                    certificate_url: existing.certificate_url,
                    verification_code: existing.verification_code,
                    already_issued: true,
                };
            }

            // Get user info
            const { data: user } = await supabase
                .from('users')
                .select('full_name, email')
                .eq('id', userId)
                .single();

            if (!user) throw new Error('User not found');

            // Verify user has completed the topic
            const completionCheck = await this.verifyTopicCompletion(userId, topic);
            if (!completionCheck.completed) {
                throw new Error(
                    `You have completed ${completionCheck.solved} of ${completionCheck.total} problems in ${topic}. Complete all to earn certificate.`
                );
            }

            // Save the record first: the PDF carries its verification code and QR link.
            const template = await CertificateTemplatesService.forCertificate('topic');
            const { data: cert, error: insertError } = await supabase
                .from('certificates')
                .insert({ user_id: userId, topic, certificate_url: '', template_id: template.id })
                .select()
                .single();
            if (insertError || !cert) throw insertError ?? new Error('Could not save the certificate');

            const pdfBytes = await renderCertificatePdf(template.layout, {
                name: user.full_name || user.email, achievement: topic, issuedAt: new Date(cert.issued_at ?? Date.now()),
                code: cert.verification_code, verifyUrl: verifyUrlFor(cert.verification_code),
            });

            // A stored copy for sharing; downloads are rendered on demand (GET /certificates/:id/pdf) anyway.
            const fileName = `certificates/${userId}/${topic.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('certificates')
                .upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });
            if (uploadError) logger.warn('Storage upload failed, saving without URL:', uploadError);
            let certificateUrl = '';
            if (uploadData) {
                certificateUrl = supabase.storage.from('certificates').getPublicUrl(fileName).data.publicUrl;
                await supabase.from('certificates').update({ certificate_url: certificateUrl }).eq('id', cert.id);
            }

            logger.info('Certificate generated', {
                userId,
                topic,
                certId: cert?.id,
            });

            return {
                id: cert?.id,
                certificate_url: certificateUrl,
                verification_code: cert?.verification_code,
                already_issued: false,
            };
        } catch (error: any) {
            logger.error('Generate certificate error:', { userId, topic, error: error.message });
            throw error;
        }
    }

    /**
     * Get user's certificates
     */
    static async getUserCertificates(userId: string) {
        try {
            const { data, error } = await supabase
                .from('certificates')
                .select('*')
                .eq('user_id', userId)
                .order('issued_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            logger.error('Get certificates error:', { userId, error });
            throw new Error('Failed to fetch certificates');
        }
    }

    /**
     * Verify a certificate by verification code
     */
    static async verifyCertificate(verificationCode: string) {
        try {
            const { data: cert, error } = await supabase
                .from('certificates')
                .select('*, user:users(full_name, email)')
                .eq('verification_code', verificationCode)
                .single();

            if (error || !cert) {
                return { valid: false, message: 'Certificate not found' };
            }
            if ((cert as any).is_valid === false) {
                return { valid: false, message: 'This certificate has been revoked' };
            }

            return {
                valid: true,
                certificate: {
                    topic: cert.topic,
                    issued_to: (cert as any).user?.full_name,
                    issued_at: cert.issued_at,
                    verification_code: cert.verification_code,
                },
            };
        } catch (error) {
            logger.error('Verify certificate error:', { verificationCode, error });
            throw new Error('Failed to verify certificate');
        }
    }

    /**
     * Check if user has completed all problems in a topic
     */
    private static async verifyTopicCompletion(userId: string, topic: string) {
        const { data: problems } = await supabase
            .from('problems')
            .select('id')
            .eq('topic', topic)
            .is('deleted_at', null)
            .eq('owner_org_id', '00000000-0000-0000-0000-00000000f0f0')
            .eq('visibility', 'public');

        if (!problems || problems.length === 0) {
            throw new Error(`No problems found for topic: ${topic}`);
        }

        const problemIds = problems.map(p => p.id);

        const { data: solved } = await supabase
            .from('submissions')
            .select('problem_id')
            .eq('user_id', userId)
            .eq('solved', true)
            .in('problem_id', problemIds);

        // Distinct problems: solving one problem many times doesn't count as solving the others.
        const solvedCount = new Set((solved ?? []).map((r) => r.problem_id)).size;

        return {
            completed: solvedCount >= problems.length,
            solved: solvedCount,
            total: problems.length,
        };
    }

    /** The owner's certificate as a PDF, drawn from its template (null when it isn't theirs). */
    static async renderPdf(userId: string, certificateId: string): Promise<{ bytes: Uint8Array; fileName: string } | null> {
        const cert = (await pool.query(
            `select c.id, c.topic, c.verification_code, c.issued_at, c.template_id, c.is_valid, u.full_name, u.email
               from public.certificates c join public.users u on u.id = c.user_id
              where c.id = $1 and c.user_id = $2`, [certificateId, userId])).rows[0];
        if (!cert || cert.is_valid === false) return null;
        const template = await CertificateTemplatesService.forCertificate('topic', cert.template_id);
        const bytes = await renderCertificatePdf(template.layout, {
            name: cert.full_name || cert.email, achievement: cert.topic, issuedAt: new Date(cert.issued_at ?? Date.now()),
            code: cert.verification_code, verifyUrl: verifyUrlFor(cert.verification_code),
        });
        return { bytes, fileName: `${String(cert.topic).replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-certificate.pdf` };
    }
}
