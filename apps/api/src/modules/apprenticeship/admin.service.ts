import { pool, supabase } from '../../config/database';

export class ApprenticeshipAdminService {
  static async getOverview() {
    const [overview, monthly, events, struggling, pendingReviews] = await Promise.all([
      pool.query(`
        select
          count(*)::int as total_enrollments,
          count(*) filter (where status = 'active')::int as active_enrollments,
          coalesce(avg(progress_percentage), 0)::numeric(5,2) as avg_completion_rate,
          count(*) filter (where certificate_issued = true)::int as certificates_issued
        from apprenticeship_enrollments
      `),
      pool.query(`
        select to_char(date_trunc('month', enrolled_at), 'YYYY-MM') as month,
               count(*)::int as enrollments
        from apprenticeship_enrollments
        where enrolled_at >= now() - interval '6 months'
        group by 1
        order by 1
      `),
      supabase
        .from('apprenticeship_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20),
      pool.query(`
        select ae.id, ae.user_id, ae.program_id, ae.enrolled_at, u.full_name, u.email, ap.title as program_title
        from apprenticeship_enrollments ae
        join users u on u.id = ae.user_id
        join apprenticeship_programs ap on ap.id = ae.program_id
        where ae.status = 'active'
          and ae.completed_projects = 0
          and ae.enrolled_at <= now() - interval '14 days'
        order by ae.enrolled_at asc
        limit 20
      `),
      supabase
        .from('apprenticeship_submissions')
        .select('*')
        .eq('verification_status', 'manual_review')
        .order('submitted_at', { ascending: true })
        .limit(20),
    ]);

    return {
      kpis: {
        ...(overview.rows[0] || {}),
        total_revenue_inr: 0,
      },
      monthly_enrollments: monthly.rows,
      latest_events: events.data || [],
      struggling_students: struggling.rows,
      pending_manual_reviews: pendingReviews.data || [],
    };
  }

  static async getStudents(search?: string, programId?: string, status?: string) {
    let query = supabase
      .from('apprenticeship_enrollments')
      .select(`
        *,
        users:user_id (id, full_name, email, xp),
        apprenticeship_programs (id, title)
      `)
      .order('enrolled_at', { ascending: false })
      .limit(100);

    if (programId) query = query.eq('program_id', programId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    const filtered = (data || []).filter((row: any) => {
      if (!search) return true;
      const haystack = `${row.users?.full_name || ''} ${row.users?.email || ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });

    return filtered;
  }

  static async getStudentDetail(userId: string) {
    const [user, enrollments, submissions, events, certificates, github] = await Promise.all([
      supabase.from('users').select('id, full_name, email, xp, created_at').eq('id', userId).single(),
      supabase
        .from('apprenticeship_enrollments')
        .select(`
          *,
          apprenticeship_programs (*),
          apprenticeship_project_progress (
            *,
            apprenticeship_projects (*)
          )
        `)
        .eq('user_id', userId),
      supabase
        .from('apprenticeship_submissions')
        .select('*')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(200),
      supabase
        .from('apprenticeship_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('apprenticeship_certificates')
        .select('*')
        .eq('user_id', userId)
        .order('issued_at', { ascending: false }),
      supabase
        .from('apprenticeship_github_connections')
        .select('github_username, is_active, connected_at')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    return {
      user: user.data,
      github: github.data,
      enrollments: enrollments.data || [],
      submissions: submissions.data || [],
      events: events.data || [],
      certificates: certificates.data || [],
    };
  }

  static async getAnalytics(programId?: string) {
    const programFilter = programId ? `and ae.program_id = '${programId}'` : '';
    const [funnel, dropoff, aiQueries, qualityDistribution] = await Promise.all([
      pool.query(`
        select
          count(*)::int as enrolled,
          count(*) filter (where completed_projects >= 1)::int as passed_project_1,
          count(*) filter (where completed_projects >= 2)::int as passed_project_2,
          count(*) filter (where completed_projects >= 3)::int as passed_project_3,
          count(*) filter (where completed_projects >= 4)::int as passed_project_4,
          count(*) filter (where completed_projects >= 5)::int as certified
        from apprenticeship_enrollments ae
        where 1 = 1 ${programFilter}
      `),
      pool.query(`
        select ap.title, ap.project_number,
               count(app.id) filter (where app.status in ('in_progress','passed'))::int as started,
               count(app.id) filter (where app.status = 'passed')::int as passed
        from apprenticeship_projects ap
        left join apprenticeship_project_progress app on app.project_id = ap.id
        ${programId ? `where ap.program_id = '${programId}'` : ''}
        group by ap.id
        order by ap.project_number
      `),
      supabase
        .from('apprenticeship_events')
        .select('event_data, project_id')
        .eq('event_type', 'ai_help_query')
        .limit(200),
      pool.query(`
        select project_id,
               avg(code_quality_score)::numeric(5,2) as avg,
               min(code_quality_score)::int as min,
               max(code_quality_score)::int as max
        from apprenticeship_submissions
        where code_quality_score is not null
        ${programId ? `and project_id in (select id from apprenticeship_projects where program_id = '${programId}')` : ''}
        group by project_id
      `),
    ]);

    return {
      funnel: funnel.rows[0] || {},
      dropoff: dropoff.rows.map((row) => ({
        ...row,
        abandonment_rate: row.started > 0 ? Number((((row.started - row.passed) / row.started) * 100).toFixed(2)) : 0,
      })),
      ai_queries: aiQueries.data || [],
      quality_distribution: qualityDistribution.rows,
    };
  }

  static async listCoupons() {
    const { data, error } = await supabase
      .from('apprenticeship_coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  static async createCoupon(payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('apprenticeship_coupons')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async updateCoupon(id: string, payload: Record<string, unknown>) {
    const { data, error } = await supabase
      .from('apprenticeship_coupons')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  static async deactivateCoupon(id: string) {
    await supabase
      .from('apprenticeship_coupons')
      .update({ is_active: false })
      .eq('id', id);
  }

  static async broadcastNotification(payload: Record<string, unknown>) {
    await supabase.from('apprenticeship_events').insert({
      user_id: null,
      session_id: `admin-notification:${Date.now()}`,
      event_type: 'admin_notification_sent',
      event_category: 'admin',
      event_data: payload,
      page_url: null,
      referrer_url: null,
      ip_address: null,
      user_agent: null,
      country_code: null,
      duration_ms: null,
      enrollment_id: null,
      project_id: null,
      submission_id: null,
    });

    return { recipients: 0 };
  }
}
