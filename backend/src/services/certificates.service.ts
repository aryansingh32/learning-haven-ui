import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from '../config/database';
import { CacheService } from './cache.service';
import logger from '../config/logger';

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

            // Generate PDF
            const pdfBytes = await this.createPDF(user.full_name, topic);

            // Upload to Supabase Storage
            const fileName = `certificates/${userId}/${topic.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('certificates')
                .upload(fileName, pdfBytes, {
                    contentType: 'application/pdf',
                    upsert: true,
                });

            if (uploadError) {
                logger.warn('Storage upload failed, saving without URL:', uploadError);
            }

            // Get public URL
            let certificateUrl = '';
            if (uploadData) {
                const { data: urlData } = supabase.storage
                    .from('certificates')
                    .getPublicUrl(fileName);
                certificateUrl = urlData.publicUrl;
            }

            // Save certificate record
            const { data: cert } = await supabase
                .from('certificates')
                .insert({
                    user_id: userId,
                    topic,
                    certificate_url: certificateUrl,
                })
                .select()
                .single();

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
            .eq('topic', topic);

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

        const solvedCount = solved?.length || 0;

        return {
            completed: solvedCount >= problems.length,
            solved: solvedCount,
            total: problems.length,
        };
    }

    /**
     * Generate a PDF certificate
     */
    private static async createPDF(name: string, topic: string): Promise<Uint8Array> {
        const doc = await PDFDocument.create();
        const page = doc.addPage([842, 595]); // A4 Landscape

        const helvetica = await doc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
        const timesRoman = await doc.embedFont(StandardFonts.TimesRomanItalic);

        const { width, height } = page.getSize();

        // Background
        page.drawRectangle({
            x: 0, y: 0, width, height,
            color: rgb(0.98, 0.97, 0.95),
        });

        // Gold border
        const borderWidth = 8;
        page.drawRectangle({
            x: borderWidth, y: borderWidth,
            width: width - 2 * borderWidth,
            height: height - 2 * borderWidth,
            borderColor: rgb(0.85, 0.65, 0.13),
            borderWidth: 3,
        });

        // Inner decorative border
        page.drawRectangle({
            x: 20, y: 20,
            width: width - 40,
            height: height - 40,
            borderColor: rgb(0.85, 0.65, 0.13),
            borderWidth: 1,
        });

        // Title
        const title = 'CERTIFICATE OF ACHIEVEMENT';
        const titleSize = 28;
        const titleWidth = helveticaBold.widthOfTextAtSize(title, titleSize);
        page.drawText(title, {
            x: (width - titleWidth) / 2,
            y: height - 100,
            size: titleSize,
            font: helveticaBold,
            color: rgb(0.15, 0.15, 0.15),
        });

        // Subtitle
        const subtitle = 'Learning Haven DSA Platform';
        const subtitleSize = 14;
        const subtitleWidth = helvetica.widthOfTextAtSize(subtitle, subtitleSize);
        page.drawText(subtitle, {
            x: (width - subtitleWidth) / 2,
            y: height - 130,
            size: subtitleSize,
            font: helvetica,
            color: rgb(0.5, 0.5, 0.5),
        });

        // Decorative line
        page.drawLine({
            start: { x: width * 0.25, y: height - 150 },
            end: { x: width * 0.75, y: height - 150 },
            thickness: 1,
            color: rgb(0.85, 0.65, 0.13),
        });

        // "This is to certify that"
        const certifyText = 'This is to certify that';
        const certifyWidth = timesRoman.widthOfTextAtSize(certifyText, 16);
        page.drawText(certifyText, {
            x: (width - certifyWidth) / 2,
            y: height - 195,
            size: 16,
            font: timesRoman,
            color: rgb(0.3, 0.3, 0.3),
        });

        // Name
        const nameSize = 36;
        const nameWidth = helveticaBold.widthOfTextAtSize(name, nameSize);
        page.drawText(name, {
            x: (width - nameWidth) / 2,
            y: height - 250,
            size: nameSize,
            font: helveticaBold,
            color: rgb(0.12, 0.12, 0.12),
        });

        // Underline under name
        page.drawLine({
            start: { x: (width - nameWidth) / 2 - 20, y: height - 258 },
            end: { x: (width + nameWidth) / 2 + 20, y: height - 258 },
            thickness: 1,
            color: rgb(0.85, 0.65, 0.13),
        });

        // Achievement text
        const achieveText = `has successfully completed all problems in`;
        const achieveWidth = helvetica.widthOfTextAtSize(achieveText, 14);
        page.drawText(achieveText, {
            x: (width - achieveWidth) / 2,
            y: height - 300,
            size: 14,
            font: helvetica,
            color: rgb(0.3, 0.3, 0.3),
        });

        // Topic name
        const topicSize = 24;
        const topicWidth = helveticaBold.widthOfTextAtSize(topic, topicSize);
        page.drawText(topic, {
            x: (width - topicWidth) / 2,
            y: height - 340,
            size: topicSize,
            font: helveticaBold,
            color: rgb(0.85, 0.65, 0.13),
        });

        // Date
        const dateText = `Issued on ${new Date().toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        })}`;
        const dateWidth = helvetica.widthOfTextAtSize(dateText, 12);
        page.drawText(dateText, {
            x: (width - dateWidth) / 2,
            y: height - 400,
            size: 12,
            font: helvetica,
            color: rgb(0.5, 0.5, 0.5),
        });

        // Footer decorative line
        page.drawLine({
            start: { x: width * 0.25, y: 80 },
            end: { x: width * 0.75, y: 80 },
            thickness: 1,
            color: rgb(0.85, 0.65, 0.13),
        });

        // Platform name at bottom
        const footerText = 'Learning Haven — Master DSA, One Problem at a Time';
        const footerWidth = helvetica.widthOfTextAtSize(footerText, 10);
        page.drawText(footerText, {
            x: (width - footerWidth) / 2,
            y: 55,
            size: 10,
            font: helvetica,
            color: rgb(0.6, 0.6, 0.6),
        });

        return doc.save();
    }
}
