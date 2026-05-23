create index if not exists idx_enroll_user_program
  on apprenticeship_enrollments(user_id, program_id);

create index if not exists idx_enroll_status
  on apprenticeship_enrollments(status)
  where status = 'active';

create index if not exists idx_proj_progress_enrollment
  on apprenticeship_project_progress(enrollment_id);

create index if not exists idx_submissions_enrollment
  on apprenticeship_submissions(enrollment_id, project_id);

create index if not exists idx_submissions_status
  on apprenticeship_submissions(verification_status);

create index if not exists idx_events_user_time
  on apprenticeship_events(user_id, created_at desc);

create index if not exists idx_events_session_time
  on apprenticeship_events(session_id, created_at desc);

create index if not exists idx_events_type_time
  on apprenticeship_events(event_type, created_at desc);

create index if not exists idx_programs_status
  on apprenticeship_programs(status)
  where status = 'active';

create index if not exists idx_submissions_manual_review
  on apprenticeship_submissions(verification_status, submitted_at)
  where verification_status = 'manual_review';

create index if not exists idx_struggling_students
  on apprenticeship_enrollments(enrolled_at, completed_projects)
  where status = 'active' and completed_projects = 0;
