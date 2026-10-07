-- Snapshot of the live public schema (structure only, no data), taken 2026-10-08
-- with pg_dump --schema-only --schema=public --no-owner --no-privileges.
-- Baseline for migrations dated after it; refresh when the live schema drifts.
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.8 (Debian 17.8-0+deb13u1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: coupon_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.coupon_type AS ENUM (
    'percentage',
    'fixed_amount'
);


--
-- Name: entitlement_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.entitlement_type AS ENUM (
    'boolean',
    'numeric_limit',
    'resource_access'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'created',
    'authorized',
    'captured',
    'failed',
    'refunded'
);


--
-- Name: plan_billing_cycle; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plan_billing_cycle AS ENUM (
    'monthly',
    'annual',
    'lifetime',
    'one_time'
);


--
-- Name: plan_content_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plan_content_type AS ENUM (
    'course',
    'challenge',
    'career_path',
    'feature'
);


--
-- Name: plan_slug; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.plan_slug AS ENUM (
    'free',
    'path_pack',
    'pro',
    'career_accelerator',
    'super'
);


--
-- Name: problem_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.problem_status AS ENUM (
    'solved',
    'tried',
    'revision'
);


--
-- Name: referral_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.referral_status AS ENUM (
    'pending',
    'active',
    'suspicious',
    'rejected',
    'expired'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'cancelled',
    'expired',
    'past_due',
    'trialing'
);


--
-- Name: withdrawal_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.withdrawal_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'rejected'
);


--
-- Name: update_apprenticeship_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_apprenticeship_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text,
    old_value jsonb,
    new_value jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_logs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    admin_id uuid NOT NULL,
    action text NOT NULL,
    resource_type text,
    resource_id uuid,
    old_value jsonb,
    new_value jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid,
    resource text NOT NULL,
    can_view boolean DEFAULT false,
    can_create boolean DEFAULT false,
    can_edit boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    type text DEFAULT 'custom'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_roles_type_check CHECK ((type = ANY (ARRAY['system'::text, 'custom'::text])))
);


--
-- Name: ai_chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_chats (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    problem_id uuid,
    tokens_used integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_chats_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);


--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    event_name text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb,
    session_id text,
    device_type text,
    browser text,
    os text,
    ip_address text,
    country text,
    city text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: apprenticeship_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apprenticeship_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    program_id uuid NOT NULL,
    verification_code text NOT NULL,
    recipient_name text NOT NULL,
    final_grade text,
    avg_code_quality_score numeric(5,2),
    projects_completed integer NOT NULL,
    certificate_url text,
    pdf_url text,
    social_share_image_url text,
    issued_at timestamp with time zone DEFAULT now(),
    CONSTRAINT apprenticeship_certificates_final_grade_check CHECK ((final_grade = ANY (ARRAY['Distinction'::text, 'Merit'::text, 'Pass'::text])))
);


--
-- Name: apprenticeship_coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apprenticeship_coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    program_id uuid,
    discount_type text,
    discount_value integer NOT NULL,
    max_uses integer,
    uses_count integer DEFAULT 0,
    per_user_limit integer DEFAULT 1,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT apprenticeship_coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['fixed'::text, 'percentage'::text])))
);


--
-- Name: apprenticeship_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apprenticeship_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    program_id uuid NOT NULL,
    payment_id uuid,
    referral_code text,
    learning_path text DEFAULT 'traditional'::text,
    enrolled_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    current_project_number integer DEFAULT 1,
    completed_projects integer DEFAULT 0,
    total_projects integer NOT NULL,
    progress_percentage numeric(5,2) DEFAULT 0,
    certificate_issued boolean DEFAULT false,
    certificate_id uuid,
    status text DEFAULT 'active'::text,
    discord_invited boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT apprenticeship_enrollments_learning_path_check CHECK ((learning_path = ANY (ARRAY['traditional'::text, 'ai_assisted'::text]))),
    CONSTRAINT apprenticeship_enrollments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'completed'::text, 'revoked'::text])))
);


--
-- Name: apprenticeship_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apprenticeship_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    session_id text NOT NULL,
    event_type text NOT NULL,
    event_category text NOT NULL,
    event_data jsonb,
    page_url text,
    referrer_url text,
    ip_address inet,
    user_agent text,
    country_code text,
    duration_ms integer,
    enrollment_id uuid,
    project_id uuid,
    submission_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: apprenticeship_github_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apprenticeship_github_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    github_username text NOT NULL,
    github_user_id bigint NOT NULL,
    access_token text NOT NULL,
    token_scopes text[],
    connected_at timestamp with time zone DEFAULT now(),
    last_used_at timestamp with time zone,
    is_active boolean DEFAULT true,
    revoked_at timestamp with time zone
);


--
-- Name: apprenticeship_post_replies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apprenticeship_post_replies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    content text NOT NULL,
    upvotes integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: apprenticeship_post_upvotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apprenticeship_post_upvotes (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: apprenticeship_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apprenticeship_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    project_id uuid,
    user_id uuid NOT NULL,
    content text NOT NULL,
    attachments jsonb,
    upvotes integer DEFAULT 0,
    replies_count integer DEFAULT 0,
    is_pinned boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: apprenticeship_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apprenticeship_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text,
    duration_days integer NOT NULL,
    price_inr integer NOT NULL,
    original_price_inr integer,
    tech_stack text[] DEFAULT '{}'::text[],
    difficulty_level text,
    total_projects integer DEFAULT 0 NOT NULL,
    learning_paths text[] DEFAULT '{traditional,ai_assisted}'::text[],
    max_enrollments integer,
    enrolled_count integer DEFAULT 0,
    avg_completion_rate numeric(4,3) DEFAULT 0,
    status text DEFAULT 'draft'::text,
    certificate_preview_url text,
    community_size integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    program_type text DEFAULT 'standard'::text NOT NULL,
    short_tagline text,
    thumbnail_url text,
    is_free boolean DEFAULT false NOT NULL,
    what_you_build text,
    what_you_learn text,
    why_build text,
    prerequisites_content text,
    supported_languages text[] DEFAULT '{}'::text[],
    testimonials_config jsonb DEFAULT '{"items": [], "auto_slide": false}'::jsonb,
    available_modes text[] DEFAULT '{traditional}'::text[] NOT NULL,
    default_mode text DEFAULT 'traditional'::text NOT NULL,
    reference_demo_url text,
    product_contract text,
    CONSTRAINT apprenticeship_programs_default_mode_check CHECK ((default_mode = ANY (ARRAY['traditional'::text, 'vibe'::text]))),
    CONSTRAINT apprenticeship_programs_difficulty_level_check CHECK ((difficulty_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text]))),
    CONSTRAINT apprenticeship_programs_program_type_check CHECK ((program_type = ANY (ARRAY['standard'::text, 'build_challenge'::text]))),
    CONSTRAINT apprenticeship_programs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text, 'live'::text, 'beta'::text])))
);


--
-- Name: COLUMN apprenticeship_programs.program_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apprenticeship_programs.program_type IS 'Discriminator: apprenticeship | build_challenge';


--
-- Name: COLUMN apprenticeship_programs.available_modes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apprenticeship_programs.available_modes IS 'Which verification modes are available: traditional (docker test) and/or vibe (proof gates)';


--
-- Name: COLUMN apprenticeship_programs.default_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apprenticeship_programs.default_mode IS 'Mode shown by default on the challenge page (traditional | vibe)';


--
-- Name: COLUMN apprenticeship_programs.reference_demo_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apprenticeship_programs.reference_demo_url IS 'URL to the live golden build that vibe learners can reference';


--
-- Name: COLUMN apprenticeship_programs.product_contract; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.apprenticeship_programs.product_contract IS 'Public product requirements spec (markdown) shown to vibe learners';


--
-- Name: apprenticeship_project_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apprenticeship_project_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'locked'::text,
    github_repo_full_name text,
    github_repo_url text,
    webhook_secret text,
    started_at timestamp with time zone,
    passed_at timestamp with time zone,
    attempts_count integer DEFAULT 0,
    best_code_quality_score integer,
    total_xp_earned integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT apprenticeship_project_progress_status_check CHECK ((status = ANY (ARRAY['locked'::text, 'available'::text, 'in_progress'::text, 'passed'::text, 'skipped'::text])))
);


--
-- Name: apprenticeship_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apprenticeship_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    project_number integer NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text,
    estimated_hours integer,
    traditional_guide jsonb,
    ai_guide jsonb,
    starter_repo_url text,
    reference_solution_url text,
    helpful_resources jsonb DEFAULT '[]'::jsonb,
    verification_mode text DEFAULT 'automated'::text,
    verification_requirements jsonb,
    docker_test_image text,
    unlock_condition text DEFAULT 'complete_previous'::text,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT apprenticeship_projects_verification_mode_check CHECK ((verification_mode = ANY (ARRAY['automated'::text, 'manual'::text])))
);


--
-- Name: apprenticeship_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apprenticeship_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id uuid NOT NULL,
    project_progress_id uuid NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    github_repo_full_name text,
    commit_hash text,
    live_url text,
    learning_path text,
    attempt_number integer NOT NULL,
    verification_status text DEFAULT 'pending'::text,
    total_tests integer,
    passed_tests integer,
    failed_tests jsonb,
    code_quality_score integer,
    security_issues jsonb,
    performance_score integer,
    execution_time_ms integer,
    console_output_tail text,
    reviewer_id uuid,
    reviewer_notes text,
    code_quality_override integer,
    xp_bonus integer DEFAULT 0,
    reviewed_at timestamp with time zone,
    submitted_at timestamp with time zone DEFAULT now(),
    testing_started_at timestamp with time zone,
    verified_at timestamp with time zone,
    xp_awarded integer DEFAULT 0,
    flagged_for_review boolean DEFAULT false,
    flag_reason text,
    CONSTRAINT apprenticeship_submissions_verification_status_check CHECK ((verification_status = ANY (ARRAY['pending'::text, 'testing'::text, 'passed'::text, 'failed'::text, 'manual_review'::text, 'manual_passed'::text, 'manual_failed'::text])))
);


--
-- Name: apprenticeship_test_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.apprenticeship_test_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    stage_number integer NOT NULL,
    stage_name text NOT NULL,
    status text,
    tests_in_stage integer,
    passed_in_stage integer,
    failed_details jsonb,
    xp_for_stage integer DEFAULT 0,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    CONSTRAINT apprenticeship_test_stages_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'passed'::text, 'failed'::text])))
);


--
-- Name: build_challenge_languages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.build_challenge_languages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    language text NOT NULL,
    starter_repo_url text NOT NULL,
    docker_test_image text,
    setup_instructions text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE build_challenge_languages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.build_challenge_languages IS 'Per-language config (starter repo, Docker image) for a build challenge';


--
-- Name: build_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.build_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    program_id uuid NOT NULL,
    language text NOT NULL,
    current_stage integer DEFAULT 1 NOT NULL,
    completed_stages integer[] DEFAULT '{}'::integer[],
    total_stages integer DEFAULT 0 NOT NULL,
    progress_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    repo_full_name text,
    repo_url text,
    webhook_secret text,
    status text DEFAULT 'in_progress'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    last_push_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    celebrated_stages integer[] DEFAULT '{}'::integer[],
    deleted_at timestamp with time zone,
    build_mode text DEFAULT 'traditional'::text NOT NULL,
    CONSTRAINT build_enrollments_build_mode_check CHECK ((build_mode = ANY (ARRAY['traditional'::text, 'vibe'::text]))),
    CONSTRAINT build_enrollments_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'abandoned'::text])))
);


--
-- Name: TABLE build_enrollments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.build_enrollments IS 'User enrollment in a build challenge for a specific language';


--
-- Name: COLUMN build_enrollments.celebrated_stages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_enrollments.celebrated_stages IS 'Stage numbers where the user has consciously clicked "Mark as Complete" in the two-step modal';


--
-- Name: COLUMN build_enrollments.build_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_enrollments.build_mode IS 'Which mode the learner chose: traditional (git push + docker test) or vibe (submit URL/repo for Playwright gates)';


--
-- Name: build_stage_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.build_stage_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id uuid NOT NULL,
    stage_id uuid NOT NULL,
    user_id uuid NOT NULL,
    commit_hash text,
    status text DEFAULT 'pending'::text NOT NULL,
    test_output text,
    exit_code integer,
    execution_time_ms integer,
    attempt_number integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    structured_feedback jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_manual_override boolean DEFAULT false,
    overridden_by_admin_id uuid,
    submission_source text,
    submission_ref text,
    CONSTRAINT build_stage_results_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'passed'::text, 'failed'::text]))),
    CONSTRAINT build_stage_results_submission_source_check CHECK ((submission_source = ANY (ARRAY['github_push'::text, 'live_url'::text, 'zip_upload'::text, 'sandbox_build'::text])))
);


--
-- Name: TABLE build_stage_results; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.build_stage_results IS 'Individual test run results per stage attempt';


--
-- Name: COLUMN build_stage_results.structured_feedback; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_stage_results.structured_feedback IS 'Structured test result payload for UI';


--
-- Name: COLUMN build_stage_results.is_manual_override; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_stage_results.is_manual_override IS 'True when an admin manually passed this stage via adminManualPassStage()';


--
-- Name: COLUMN build_stage_results.submission_source; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_stage_results.submission_source IS 'How the submission arrived: github_push | live_url | zip_upload | sandbox_build';


--
-- Name: COLUMN build_stage_results.submission_ref; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_stage_results.submission_ref IS 'Submission reference: commit hash, deployment URL, or storage object path';


--
-- Name: build_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.build_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    stage_number integer NOT NULL,
    title text NOT NULL,
    difficulty text DEFAULT 'easy'::text NOT NULL,
    description text,
    instructions text,
    code_example text,
    hints jsonb DEFAULT '[]'::jsonb,
    test_command text,
    expected_exit_code integer DEFAULT 0,
    success_criteria jsonb DEFAULT '{}'::jsonb,
    estimated_minutes integer,
    docs_url text,
    image_url text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    docker_test_image text,
    timeout_seconds integer DEFAULT 120 NOT NULL,
    concepts_content text,
    short_id text DEFAULT upper(substr(md5((random())::text), 1, 3)) NOT NULL,
    randomization_config jsonb,
    deleted_at timestamp with time zone,
    verification_type text DEFAULT 'docker_test'::text NOT NULL,
    acceptance_contract jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT build_stages_difficulty_check CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text]))),
    CONSTRAINT build_stages_verification_type_check CHECK ((verification_type = ANY (ARRAY['docker_test'::text, 'contract'::text])))
);


--
-- Name: TABLE build_stages; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.build_stages IS 'Individual stages within a build challenge';


--
-- Name: COLUMN build_stages.timeout_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_stages.timeout_seconds IS 'Docker test runner timeout per stage (seconds)';


--
-- Name: COLUMN build_stages.concepts_content; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_stages.concepts_content IS 'Markdown tutorial content shown in the Concepts tab for this stage';


--
-- Name: COLUMN build_stages.randomization_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_stages.randomization_config IS 'Template variable config for randomized test inputs. Example: {"random_fruit": {"type": "random_choice", "values": ["apple", "banana", "mango"]}}';


--
-- Name: COLUMN build_stages.verification_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_stages.verification_type IS 'How this stage is verified: docker_test (exit code + regex) or contract (Playwright journey gates)';


--
-- Name: COLUMN build_stages.acceptance_contract; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.build_stages.acceptance_contract IS 'Proof gate spec for contract stages: { journeys, api_checks, visual_checks }';


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    icon text,
    color text DEFAULT '#6366f1'::text,
    order_index integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true,
    problem_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    topic text NOT NULL,
    verification_code text DEFAULT "substring"(md5((random())::text), 1, 12) NOT NULL,
    certificate_url text,
    issued_at timestamp with time zone DEFAULT now()
);


--
-- Name: chapter_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapter_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chapter_id uuid,
    video_youtube_id text,
    video_channel text,
    video_title text,
    video_duration integer,
    video_timestamps jsonb DEFAULT '[]'::jsonb,
    article_url text,
    article_source text,
    article_title text,
    problems jsonb DEFAULT '[]'::jsonb,
    quiz jsonb DEFAULT '[]'::jsonb,
    tasks jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: chapters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chapters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid,
    chapter_number integer NOT NULL,
    title text NOT NULL,
    topic_tag text,
    difficulty text DEFAULT 'BEGINNER'::text,
    story_hook text,
    whatsapp_msg text,
    est_minutes integer DEFAULT 60,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chapters_difficulty_check CHECK ((difficulty = ANY (ARRAY['BEGINNER'::text, 'INTERMEDIATE'::text, 'ADVANCED'::text])))
);


--
-- Name: content_import_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_import_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_type text NOT NULL,
    source text NOT NULL,
    source_ref text,
    uploaded_by uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    total_rows integer DEFAULT 0 NOT NULL,
    valid_rows integer DEFAULT 0 NOT NULL,
    error_rows integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT content_import_batches_content_type_check CHECK ((content_type = ANY (ARRAY['chapters_meta'::text, 'chapter_steps'::text, 'problems'::text, 'build_stages'::text, 'testseries_questions'::text]))),
    CONSTRAINT content_import_batches_source_check CHECK ((source = ANY (ARRAY['upload'::text, 'sheet_url'::text, 'json'::text]))),
    CONSTRAINT content_import_batches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'published'::text, 'rejected'::text])))
);


--
-- Name: TABLE content_import_batches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.content_import_batches IS 'One row per staged import session. Status moves pending -> reviewed -> published (or rejected).';


--
-- Name: content_import_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_import_rows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    row_number integer NOT NULL,
    raw_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    resolved_entity_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_import_rows_status_check CHECK ((status = ANY (ARRAY['valid'::text, 'error'::text, 'warning'::text])))
);


--
-- Name: TABLE content_import_rows; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.content_import_rows IS 'Individual parsed rows within a content import batch. resolved_entity_id is set after publish.';


--
-- Name: content_plan_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_plan_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    content_type public.plan_content_type NOT NULL,
    content_id uuid,
    feature_key text,
    feature_limit integer DEFAULT '-1'::integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_or_feature CHECK ((((content_id IS NOT NULL) AND (feature_key IS NULL)) OR ((content_id IS NULL) AND (feature_key IS NOT NULL))))
);


--
-- Name: TABLE content_plan_assignments; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.content_plan_assignments IS 'Single source of truth for which plans include which content and monetized feature limits.';


--
-- Name: COLUMN content_plan_assignments.feature_limit; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.content_plan_assignments.feature_limit IS '-1 = unlimited, 0 = disabled, positive value = capped usage.';


--
-- Name: coupon_usages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_usages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coupon_id uuid NOT NULL,
    user_id uuid NOT NULL,
    payment_id uuid,
    discount_applied integer DEFAULT 0 NOT NULL,
    used_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: coupons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text,
    type public.coupon_type NOT NULL,
    value integer NOT NULL,
    max_discount integer,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    min_order_amount integer DEFAULT 0 NOT NULL,
    applicable_plan_slugs text[] DEFAULT '{}'::text[],
    applicable_billing_cycles text[] DEFAULT '{}'::text[],
    one_use_per_user boolean DEFAULT true NOT NULL,
    valid_from timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coupons_value_check CHECK ((value > 0))
);


--
-- Name: course_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    enrolled_at timestamp with time zone DEFAULT now(),
    status character varying(50) DEFAULT 'active'::character varying,
    progress_percentage integer DEFAULT 0,
    completed_at timestamp with time zone
);


--
-- Name: course_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_items (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    course_id uuid NOT NULL,
    problem_id uuid,
    day_number integer NOT NULL,
    title text NOT NULL,
    description text,
    section text,
    order_index integer DEFAULT 0 NOT NULL,
    is_milestone boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    description text,
    type text DEFAULT 'custom'::text NOT NULL,
    duration_days integer,
    difficulty_level text DEFAULT 'beginner'::text,
    cover_image text,
    is_premium boolean DEFAULT false,
    is_published boolean DEFAULT true,
    item_count integer DEFAULT 0,
    enrolled_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    meta jsonb,
    order_index integer DEFAULT 0,
    category_id uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT roadmaps_difficulty_level_check CHECK ((difficulty_level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'mixed'::text]))),
    CONSTRAINT roadmaps_type_check CHECK ((type = ANY (ARRAY['zero_to_hero'::text, 'revision'::text, 'topic_wise'::text, 'company_wise'::text, 'custom'::text, 'phase'::text])))
);


--
-- Name: exam_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    description text,
    icon_url text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: feature_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_flags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    rollout_percentage integer DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feature_flags_rollout_percentage_check CHECK (((rollout_percentage >= 0) AND (rollout_percentage <= 100)))
);


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    type text DEFAULT 'general'::text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    rating integer,
    status text DEFAULT 'new'::text,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT feedback_status_check CHECK ((status = ANY (ARRAY['new'::text, 'read'::text, 'in_progress'::text, 'resolved'::text, 'dismissed'::text]))),
    CONSTRAINT feedback_type_check CHECK ((type = ANY (ARRAY['general'::text, 'bug'::text, 'feature'::text, 'content'::text, 'ui'::text])))
);


--
-- Name: idempotency_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    request_hash text NOT NULL,
    method text,
    path text,
    user_id uuid,
    response jsonb,
    status_code integer,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    company text NOT NULL,
    type text,
    apply_url text NOT NULL,
    deadline timestamp with time zone,
    stipend text,
    description text,
    tags jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    posted_at timestamp with time zone DEFAULT now(),
    CONSTRAINT job_alerts_type_check CHECK ((type = ANY (ARRAY['JOB'::text, 'INTERNSHIP'::text, 'HACKATHON'::text, 'SCHOLARSHIP'::text])))
);


--
-- Name: job_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_logs (
    id integer NOT NULL,
    job_id text NOT NULL,
    user_id text NOT NULL,
    type text NOT NULL,
    site_id text,
    task text,
    status text DEFAULT 'queued'::text,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    duration_ms integer,
    success boolean,
    error_message text,
    ai_call_count integer DEFAULT 0,
    selector_fallback_cnt integer DEFAULT 0,
    retry_count integer DEFAULT 0,
    result jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: job_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.job_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: job_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.job_logs_id_seq OWNED BY public.job_logs.id;


--
-- Name: otp_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone text NOT NULL,
    otp_hash text NOT NULL,
    attempts integer DEFAULT 0,
    expires_at timestamp with time zone NOT NULL,
    verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patterns (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    category_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    order_index integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true,
    problem_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    subscription_id uuid,
    amount integer NOT NULL,
    discount_amount integer DEFAULT 0 NOT NULL,
    tax_amount integer DEFAULT 0 NOT NULL,
    final_amount integer NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    status public.payment_status DEFAULT 'created'::public.payment_status NOT NULL,
    razorpay_order_id text NOT NULL,
    razorpay_payment_id text,
    razorpay_signature text,
    coupon_id uuid,
    coupon_code text,
    referral_id uuid,
    billing_cycle public.plan_billing_cycle NOT NULL,
    description text,
    idempotency_key text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_check CHECK ((amount >= 0)),
    CONSTRAINT payments_discount_amount_check CHECK ((discount_amount >= 0)),
    CONSTRAINT payments_final_amount_check CHECK ((final_amount >= 0)),
    CONSTRAINT payments_tax_amount_check CHECK ((tax_amount >= 0))
);


--
-- Name: phases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    roadmap_id uuid,
    title text NOT NULL,
    slug text NOT NULL,
    description text,
    display_order integer NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: plan_entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    feature_key text NOT NULL,
    label text,
    entitlement_type public.entitlement_type NOT NULL,
    bool_value boolean,
    numeric_value integer,
    resource_type text,
    resource_id uuid,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug public.plan_slug NOT NULL,
    description text,
    tagline text,
    price_monthly integer DEFAULT 0 NOT NULL,
    price_annual integer DEFAULT 0 NOT NULL,
    price_lifetime integer,
    price_one_time integer,
    is_active boolean DEFAULT true NOT NULL,
    is_highlighted boolean DEFAULT false NOT NULL,
    highlight_label text,
    badge_color text DEFAULT '#6366f1'::text,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plans_price_annual_check CHECK ((price_annual >= 0)),
    CONSTRAINT plans_price_lifetime_check CHECK ((price_lifetime >= 0)),
    CONSTRAINT plans_price_monthly_check CHECK ((price_monthly >= 0)),
    CONSTRAINT plans_price_one_time_check CHECK ((price_one_time >= 0))
);


--
-- Name: problem_patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.problem_patterns (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    problem_id uuid NOT NULL,
    pattern_id uuid NOT NULL,
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: problems; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.problems (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    difficulty text NOT NULL,
    topic text NOT NULL,
    companies text[] DEFAULT '{}'::text[],
    hints text[] DEFAULT '{}'::text[],
    constraints text,
    solution_code jsonb DEFAULT '{}'::jsonb,
    solution_explanation text,
    time_complexity text,
    space_complexity text,
    is_premium boolean DEFAULT false,
    required_plan text DEFAULT 'free'::text,
    order_index integer NOT NULL,
    solved_count integer DEFAULT 0,
    acceptance_rate numeric(5,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((title || ' '::text) || description) || ' '::text) || topic))) STORED,
    category_id uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT problems_difficulty_check CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text])))
);


--
-- Name: program_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    enrollment_id uuid,
    user_id uuid NOT NULL,
    certificate_code text NOT NULL,
    status text DEFAULT 'issued'::text NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: program_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    user_id uuid NOT NULL,
    legacy_source text,
    legacy_id uuid,
    status text DEFAULT 'active'::text NOT NULL,
    current_stage_number integer DEFAULT 1 NOT NULL,
    progress_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: program_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submission_id uuid NOT NULL,
    reviewer_id uuid,
    status text NOT NULL,
    feedback text,
    score numeric(6,2),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: program_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    legacy_source text,
    legacy_id uuid,
    stage_number integer NOT NULL,
    title text NOT NULL,
    description text,
    content jsonb DEFAULT '{}'::jsonb NOT NULL,
    docker_test_image text,
    test_command text,
    timeout_seconds integer DEFAULT 120 NOT NULL,
    xp_reward integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: program_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    stage_id uuid,
    enrollment_id uuid,
    user_id uuid NOT NULL,
    legacy_source text,
    legacy_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    attempt_number integer DEFAULT 1 NOT NULL,
    repo_full_name text,
    commit_hash text,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    legacy_source text,
    legacy_id uuid,
    type text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text,
    difficulty text,
    category_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT programs_type_check CHECK ((type = ANY (ARRAY['build_haven'::text, 'apprenticeship'::text, 'course'::text, 'career_track'::text])))
);


--
-- Name: question_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stimulus text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: referral_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code text NOT NULL,
    is_custom boolean DEFAULT false NOT NULL,
    custom_label text,
    custom_commission_pct integer,
    custom_commission_fixed integer,
    is_active boolean DEFAULT true NOT NULL,
    total_referrals integer DEFAULT 0 NOT NULL,
    total_earnings integer DEFAULT 0 NOT NULL,
    created_by_admin uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT referral_codes_custom_commission_fixed_check CHECK (((custom_commission_fixed IS NULL) OR (custom_commission_fixed >= 0))),
    CONSTRAINT referral_codes_custom_commission_pct_check CHECK (((custom_commission_pct IS NULL) OR ((custom_commission_pct >= 0) AND (custom_commission_pct <= 100))))
);


--
-- Name: referral_commission_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referral_commission_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tier_name text NOT NULL,
    emoji text DEFAULT '🥉'::text,
    min_referrals integer NOT NULL,
    max_referrals integer,
    commission_pct integer NOT NULL,
    bonus_amount integer DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT referral_commission_tiers_commission_pct_check CHECK (((commission_pct >= 0) AND (commission_pct <= 100)))
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_id uuid NOT NULL,
    referred_user_id uuid NOT NULL,
    referral_code_id uuid,
    referral_code_used text NOT NULL,
    status public.referral_status DEFAULT 'pending'::public.referral_status NOT NULL,
    payment_id uuid,
    earned_amount integer DEFAULT 0 NOT NULL,
    commission_pct integer DEFAULT 10 NOT NULL,
    fraud_score integer DEFAULT 0 NOT NULL,
    is_suspicious boolean DEFAULT false NOT NULL,
    signup_ip inet,
    signup_device_fingerprint text,
    fraud_reasons jsonb DEFAULT '[]'::jsonb,
    credit_eligible_at timestamp with time zone,
    credited_at timestamp with time zone,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    admin_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT no_self_referral CHECK ((referrer_id <> referred_user_id)),
    CONSTRAINT referrals_fraud_score_check CHECK (((fraud_score >= 0) AND (fraud_score <= 100)))
);


--
-- Name: site_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_id text NOT NULL,
    workflow_key text NOT NULL,
    category text,
    name text NOT NULL,
    trigger text NOT NULL,
    trigger_phrases jsonb DEFAULT '[]'::jsonb,
    portal_type text,
    site_section text,
    entry_url text,
    page_url text,
    page_url_pattern text,
    page_url_patterns jsonb DEFAULT '[]'::jsonb,
    required_inputs jsonb DEFAULT '[]'::jsonb,
    required_files jsonb DEFAULT '[]'::jsonb,
    instructions text,
    default_profile_name text,
    starter_action_plan jsonb DEFAULT '[]'::jsonb,
    error_recovery_plan jsonb DEFAULT '[]'::jsonb,
    version integer DEFAULT 1,
    is_active boolean DEFAULT true,
    completion_artifact text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: sites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    domain text NOT NULL,
    page_count integer DEFAULT 0,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: step_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.step_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    step_id uuid,
    data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chapter_id uuid,
    step_number integer NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    content jsonb DEFAULT '{}'::jsonb
);


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    problem_id uuid NOT NULL,
    solved boolean DEFAULT false,
    code text,
    language text NOT NULL,
    time_spent_seconds integer,
    memory_used_kb integer,
    has_notes boolean DEFAULT false,
    notes text,
    marked_for_revision boolean DEFAULT false,
    submitted_at timestamp with time zone DEFAULT now(),
    CONSTRAINT submissions_language_check CHECK ((language = ANY (ARRAY['javascript'::text, 'python'::text, 'java'::text, 'cpp'::text, 'go'::text])))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status public.subscription_status DEFAULT 'active'::public.subscription_status NOT NULL,
    billing_cycle public.plan_billing_cycle NOT NULL,
    amount_paid integer NOT NULL,
    currency text DEFAULT 'INR'::text NOT NULL,
    current_period_start timestamp with time zone DEFAULT now() NOT NULL,
    current_period_end timestamp with time zone NOT NULL,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    razorpay_subscription_id text,
    trial_end timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_amount_paid_check CHECK ((amount_paid >= 0))
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    category text DEFAULT 'general'::text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    type text DEFAULT 'custom'::text NOT NULL,
    problem_id uuid,
    roadmap_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'medium'::text,
    due_date date,
    completed_at timestamp with time zone,
    assigned_by uuid,
    is_admin_assigned boolean DEFAULT false,
    xp_reward integer DEFAULT 10,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'skipped'::text]))),
    CONSTRAINT tasks_type_check CHECK ((type = ANY (ARRAY['custom'::text, 'problem'::text, 'roadmap'::text, 'admin_assigned'::text])))
);


--
-- Name: test_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    test_id uuid NOT NULL,
    status text DEFAULT 'in_progress'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    submitted_at timestamp with time zone,
    answers jsonb DEFAULT '[]'::jsonb NOT NULL,
    score numeric(8,2),
    correct_count integer,
    total_questions integer NOT NULL,
    total_marks numeric(8,2) NOT NULL,
    percentile numeric(5,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT test_attempts_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text])))
);


--
-- Name: TABLE test_attempts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.test_attempts IS 'Standalone CBT attempts. expires_at is server-set at start and authoritative; never derived from client-reported time.';


--
-- Name: test_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    question_id uuid NOT NULL,
    section_id uuid,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: test_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    duration_seconds integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: test_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_series (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    exam_category_id uuid NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    description text,
    year integer,
    is_free boolean DEFAULT false NOT NULL,
    price numeric(10,2) DEFAULT 0 NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    test_series_id uuid,
    slug text NOT NULL,
    title text NOT NULL,
    instructions text,
    duration_seconds integer NOT NULL,
    is_sectional boolean DEFAULT false NOT NULL,
    section_time_locked boolean DEFAULT false NOT NULL,
    is_free boolean DEFAULT false NOT NULL,
    release_at timestamp with time zone,
    is_published boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT tests_duration_seconds_check CHECK ((duration_seconds > 0))
);


--
-- Name: testseries_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.testseries_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_group_id uuid,
    question_type text NOT NULL,
    body text NOT NULL,
    options jsonb,
    correct_options jsonb,
    nat_answer numeric,
    nat_tolerance numeric DEFAULT 0 NOT NULL,
    marks numeric(6,2) DEFAULT 1 NOT NULL,
    negative_marks numeric(6,2) DEFAULT 0 NOT NULL,
    topic text,
    difficulty text,
    explanation text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_mcq_msq_options CHECK (((question_type = 'nat'::text) OR ((options IS NOT NULL) AND (correct_options IS NOT NULL)))),
    CONSTRAINT chk_nat_answer CHECK (((question_type <> 'nat'::text) OR (nat_answer IS NOT NULL))),
    CONSTRAINT testseries_questions_difficulty_check CHECK ((difficulty = ANY (ARRAY['easy'::text, 'medium'::text, 'hard'::text]))),
    CONSTRAINT testseries_questions_question_type_check CHECK ((question_type = ANY (ARRAY['mcq'::text, 'msq'::text, 'nat'::text])))
);


--
-- Name: user_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    badge_id text NOT NULL,
    badge_name text,
    badge_emoji text,
    earned_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_chapter_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_chapter_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    chapter_id uuid,
    status text DEFAULT 'LOCKED'::text,
    quiz_score double precision,
    quiz_attempts integer DEFAULT 0,
    tasks_completed integer DEFAULT 0,
    used_skip_token boolean DEFAULT false,
    unlocked_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    steps_completed text[] DEFAULT '{}'::text[],
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_chapter_progress_status_check CHECK ((status = ANY (ARRAY['LOCKED'::text, 'UNLOCKED'::text, 'IN_PROGRESS'::text, 'COMPLETED'::text])))
);


--
-- Name: user_daily_quests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_daily_quests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    quest_date date DEFAULT CURRENT_DATE NOT NULL,
    quests jsonb DEFAULT '[]'::jsonb NOT NULL,
    reward_claimed boolean DEFAULT false NOT NULL,
    reward_xp integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    feature_key text NOT NULL,
    entitlement_type public.entitlement_type DEFAULT 'resource_access'::public.entitlement_type NOT NULL,
    bool_value boolean,
    numeric_value integer,
    resource_type text,
    resource_id uuid,
    label text,
    description text,
    source_payment_id uuid,
    source_subscription_id uuid,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    category text,
    original_name text,
    stored_path text,
    mime_type text,
    file_size_bytes bigint,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_memory_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_memory_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id text NOT NULL,
    profile_name text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    problem_id uuid NOT NULL,
    content text,
    pattern_notes text,
    mistake_log jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_problem_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_problem_status (
    user_id uuid NOT NULL,
    problem_id uuid NOT NULL,
    status public.problem_status NOT NULL,
    solved_at timestamp with time zone,
    time_spent integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_progress (
    user_id uuid NOT NULL,
    step_id uuid NOT NULL,
    completed boolean DEFAULT false,
    completed_at timestamp with time zone,
    time_spent integer DEFAULT 0
);


--
-- Name: user_streaks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_streaks (
    user_id uuid NOT NULL,
    current_streak integer DEFAULT 0,
    max_streak integer DEFAULT 0,
    last_activity_date date DEFAULT CURRENT_DATE
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    avatar_url text,
    phone text,
    current_plan text DEFAULT 'free'::text,
    plan_expires_at timestamp with time zone,
    xp integer DEFAULT 0,
    level integer DEFAULT 1,
    streak integer DEFAULT 0,
    longest_streak integer DEFAULT 0,
    last_active_date date,
    referral_code text DEFAULT "substring"(md5((random())::text), 1, 8) NOT NULL,
    referred_by uuid,
    wallet_balance integer DEFAULT 0,
    preferences jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone,
    study_time_total bigint DEFAULT 0,
    last_study_session timestamp with time zone,
    role text DEFAULT 'user'::text NOT NULL,
    is_banned boolean DEFAULT false,
    college_name text,
    year_of_study text,
    skip_tokens_remaining integer DEFAULT 2,
    onboarding_completed boolean DEFAULT false,
    onboarding_answers jsonb,
    receive_job_alerts boolean DEFAULT true,
    doubt_queries_used integer DEFAULT 0,
    streak_count integer DEFAULT 0,
    last_activity_date date,
    streak_freeze_count integer DEFAULT 1 NOT NULL,
    admin_role_id uuid,
    total_referral_earnings integer DEFAULT 0 NOT NULL,
    active_subscription_id uuid,
    career_track text,
    learning_goal text,
    daily_time_minutes integer,
    CONSTRAINT users_current_plan_check CHECK ((current_plan = ANY (ARRAY['free'::text, 'path_pack'::text, 'pro'::text, 'super'::text, 'career_accelerator'::text]))),
    CONSTRAINT users_level_check CHECK ((level >= 1)),
    CONSTRAINT users_longest_streak_check CHECK ((longest_streak >= 0)),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text, 'super_admin'::text]))),
    CONSTRAINT users_streak_check CHECK ((streak >= 0)),
    CONSTRAINT users_study_time_total_check CHECK ((study_time_total >= 0)),
    CONSTRAINT users_wallet_balance_check CHECK ((wallet_balance >= 0)),
    CONSTRAINT users_xp_check CHECK ((xp >= 0)),
    CONSTRAINT valid_email CHECK ((email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'::text))
);


--
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    upi_id text NOT NULL,
    status public.withdrawal_status DEFAULT 'pending'::public.withdrawal_status NOT NULL,
    transaction_id text,
    failure_reason text,
    admin_note text,
    processed_by uuid,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT withdrawals_amount_check CHECK ((amount >= 10000))
);


--
-- Name: job_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_logs ALTER COLUMN id SET DEFAULT nextval('public.job_logs_id_seq'::regclass);


--
-- Name: admin_audit_logs admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_logs admin_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_permissions admin_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permissions
    ADD CONSTRAINT admin_permissions_pkey PRIMARY KEY (id);


--
-- Name: admin_permissions admin_permissions_role_id_resource_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permissions
    ADD CONSTRAINT admin_permissions_role_id_resource_key UNIQUE (role_id, resource);


--
-- Name: admin_roles admin_roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roles
    ADD CONSTRAINT admin_roles_name_key UNIQUE (name);


--
-- Name: admin_roles admin_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roles
    ADD CONSTRAINT admin_roles_pkey PRIMARY KEY (id);


--
-- Name: ai_chats ai_chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chats
    ADD CONSTRAINT ai_chats_pkey PRIMARY KEY (id);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: apprenticeship_certificates apprenticeship_certificates_enrollment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_certificates
    ADD CONSTRAINT apprenticeship_certificates_enrollment_id_key UNIQUE (enrollment_id);


--
-- Name: apprenticeship_certificates apprenticeship_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_certificates
    ADD CONSTRAINT apprenticeship_certificates_pkey PRIMARY KEY (id);


--
-- Name: apprenticeship_certificates apprenticeship_certificates_verification_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_certificates
    ADD CONSTRAINT apprenticeship_certificates_verification_code_key UNIQUE (verification_code);


--
-- Name: apprenticeship_coupons apprenticeship_coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_coupons
    ADD CONSTRAINT apprenticeship_coupons_code_key UNIQUE (code);


--
-- Name: apprenticeship_coupons apprenticeship_coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_coupons
    ADD CONSTRAINT apprenticeship_coupons_pkey PRIMARY KEY (id);


--
-- Name: apprenticeship_enrollments apprenticeship_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_enrollments
    ADD CONSTRAINT apprenticeship_enrollments_pkey PRIMARY KEY (id);


--
-- Name: apprenticeship_enrollments apprenticeship_enrollments_user_id_program_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_enrollments
    ADD CONSTRAINT apprenticeship_enrollments_user_id_program_id_key UNIQUE (user_id, program_id);


--
-- Name: apprenticeship_events apprenticeship_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_events
    ADD CONSTRAINT apprenticeship_events_pkey PRIMARY KEY (id);


--
-- Name: apprenticeship_github_connections apprenticeship_github_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_github_connections
    ADD CONSTRAINT apprenticeship_github_connections_pkey PRIMARY KEY (id);


--
-- Name: apprenticeship_github_connections apprenticeship_github_connections_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_github_connections
    ADD CONSTRAINT apprenticeship_github_connections_user_id_key UNIQUE (user_id);


--
-- Name: apprenticeship_post_replies apprenticeship_post_replies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_post_replies
    ADD CONSTRAINT apprenticeship_post_replies_pkey PRIMARY KEY (id);


--
-- Name: apprenticeship_post_upvotes apprenticeship_post_upvotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_post_upvotes
    ADD CONSTRAINT apprenticeship_post_upvotes_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: apprenticeship_posts apprenticeship_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_posts
    ADD CONSTRAINT apprenticeship_posts_pkey PRIMARY KEY (id);


--
-- Name: apprenticeship_programs apprenticeship_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_programs
    ADD CONSTRAINT apprenticeship_programs_pkey PRIMARY KEY (id);


--
-- Name: apprenticeship_programs apprenticeship_programs_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_programs
    ADD CONSTRAINT apprenticeship_programs_slug_key UNIQUE (slug);


--
-- Name: apprenticeship_project_progress apprenticeship_project_progress_enrollment_id_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_project_progress
    ADD CONSTRAINT apprenticeship_project_progress_enrollment_id_project_id_key UNIQUE (enrollment_id, project_id);


--
-- Name: apprenticeship_project_progress apprenticeship_project_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_project_progress
    ADD CONSTRAINT apprenticeship_project_progress_pkey PRIMARY KEY (id);


--
-- Name: apprenticeship_projects apprenticeship_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_projects
    ADD CONSTRAINT apprenticeship_projects_pkey PRIMARY KEY (id);


--
-- Name: apprenticeship_projects apprenticeship_projects_program_id_project_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_projects
    ADD CONSTRAINT apprenticeship_projects_program_id_project_number_key UNIQUE (program_id, project_number);


--
-- Name: apprenticeship_submissions apprenticeship_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_submissions
    ADD CONSTRAINT apprenticeship_submissions_pkey PRIMARY KEY (id);


--
-- Name: apprenticeship_test_stages apprenticeship_test_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_test_stages
    ADD CONSTRAINT apprenticeship_test_stages_pkey PRIMARY KEY (id);


--
-- Name: build_challenge_languages build_challenge_languages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_challenge_languages
    ADD CONSTRAINT build_challenge_languages_pkey PRIMARY KEY (id);


--
-- Name: build_challenge_languages build_challenge_languages_program_id_language_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_challenge_languages
    ADD CONSTRAINT build_challenge_languages_program_id_language_key UNIQUE (program_id, language);


--
-- Name: build_challenge_languages build_challenge_languages_program_language_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_challenge_languages
    ADD CONSTRAINT build_challenge_languages_program_language_key UNIQUE (program_id, language);


--
-- Name: build_enrollments build_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_enrollments
    ADD CONSTRAINT build_enrollments_pkey PRIMARY KEY (id);


--
-- Name: build_enrollments build_enrollments_user_id_program_id_language_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_enrollments
    ADD CONSTRAINT build_enrollments_user_id_program_id_language_key UNIQUE (user_id, program_id, language);


--
-- Name: build_enrollments build_enrollments_user_program_language_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_enrollments
    ADD CONSTRAINT build_enrollments_user_program_language_key UNIQUE (user_id, program_id, language);


--
-- Name: build_stage_results build_stage_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_stage_results
    ADD CONSTRAINT build_stage_results_pkey PRIMARY KEY (id);


--
-- Name: build_stages build_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_stages
    ADD CONSTRAINT build_stages_pkey PRIMARY KEY (id);


--
-- Name: build_stages build_stages_program_id_stage_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_stages
    ADD CONSTRAINT build_stages_program_id_stage_number_key UNIQUE (program_id, stage_number);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: certificates certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_pkey PRIMARY KEY (id);


--
-- Name: certificates certificates_verification_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_verification_code_key UNIQUE (verification_code);


--
-- Name: chapter_content chapter_content_chapter_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_content
    ADD CONSTRAINT chapter_content_chapter_id_key UNIQUE (chapter_id);


--
-- Name: chapter_content chapter_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_content
    ADD CONSTRAINT chapter_content_pkey PRIMARY KEY (id);


--
-- Name: chapters chapters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);


--
-- Name: chapters chapters_roadmap_id_chapter_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_roadmap_id_chapter_number_key UNIQUE (course_id, chapter_number);


--
-- Name: content_import_batches content_import_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_import_batches
    ADD CONSTRAINT content_import_batches_pkey PRIMARY KEY (id);


--
-- Name: content_import_rows content_import_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_import_rows
    ADD CONSTRAINT content_import_rows_pkey PRIMARY KEY (id);


--
-- Name: content_plan_assignments content_plan_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_plan_assignments
    ADD CONSTRAINT content_plan_assignments_pkey PRIMARY KEY (id);


--
-- Name: content_plan_assignments content_plan_assignments_plan_id_content_type_content_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_plan_assignments
    ADD CONSTRAINT content_plan_assignments_plan_id_content_type_content_id_key UNIQUE (plan_id, content_type, content_id);


--
-- Name: content_plan_assignments content_plan_assignments_plan_id_feature_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_plan_assignments
    ADD CONSTRAINT content_plan_assignments_plan_id_feature_key_key UNIQUE (plan_id, feature_key);


--
-- Name: coupon_usages coupon_usages_coupon_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_coupon_id_user_id_key UNIQUE (coupon_id, user_id);


--
-- Name: coupon_usages coupon_usages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_pkey PRIMARY KEY (id);


--
-- Name: coupons coupons_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_code_key UNIQUE (code);


--
-- Name: coupons coupons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);


--
-- Name: course_enrollments course_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_pkey PRIMARY KEY (id);


--
-- Name: course_enrollments course_enrollments_user_id_course_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_user_id_course_id_key UNIQUE (user_id, course_id);


--
-- Name: course_items course_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_items
    ADD CONSTRAINT course_items_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: exam_categories exam_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_categories
    ADD CONSTRAINT exam_categories_pkey PRIMARY KEY (id);


--
-- Name: exam_categories exam_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_categories
    ADD CONSTRAINT exam_categories_slug_key UNIQUE (slug);


--
-- Name: feature_flags feature_flags_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_key_key UNIQUE (key);


--
-- Name: feature_flags feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_flags
    ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: idempotency_keys idempotency_keys_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_key_key UNIQUE (key);


--
-- Name: idempotency_keys idempotency_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency_keys
    ADD CONSTRAINT idempotency_keys_pkey PRIMARY KEY (id);


--
-- Name: job_alerts job_alerts_apply_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_alerts
    ADD CONSTRAINT job_alerts_apply_url_key UNIQUE (apply_url);


--
-- Name: job_alerts job_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_alerts
    ADD CONSTRAINT job_alerts_pkey PRIMARY KEY (id);


--
-- Name: job_logs job_logs_job_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_logs
    ADD CONSTRAINT job_logs_job_id_key UNIQUE (job_id);


--
-- Name: job_logs job_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_logs
    ADD CONSTRAINT job_logs_pkey PRIMARY KEY (id);


--
-- Name: referral_codes one_code_per_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT one_code_per_user UNIQUE (user_id, is_custom);


--
-- Name: otp_verifications otp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_verifications
    ADD CONSTRAINT otp_verifications_pkey PRIMARY KEY (id);


--
-- Name: patterns patterns_category_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patterns
    ADD CONSTRAINT patterns_category_id_name_key UNIQUE (category_id, name);


--
-- Name: patterns patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patterns
    ADD CONSTRAINT patterns_pkey PRIMARY KEY (id);


--
-- Name: patterns patterns_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patterns
    ADD CONSTRAINT patterns_slug_key UNIQUE (slug);


--
-- Name: payments payments_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_razorpay_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_razorpay_order_id_key UNIQUE (razorpay_order_id);


--
-- Name: phases phases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phases
    ADD CONSTRAINT phases_pkey PRIMARY KEY (id);


--
-- Name: phases phases_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phases
    ADD CONSTRAINT phases_slug_key UNIQUE (slug);


--
-- Name: plan_entitlements plan_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_entitlements
    ADD CONSTRAINT plan_entitlements_pkey PRIMARY KEY (id);


--
-- Name: plan_entitlements plan_entitlements_plan_id_feature_key_resource_type_resourc_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_entitlements
    ADD CONSTRAINT plan_entitlements_plan_id_feature_key_resource_type_resourc_key UNIQUE (plan_id, feature_key, resource_type, resource_id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: plans plans_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_slug_key UNIQUE (slug);


--
-- Name: problem_patterns problem_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_patterns
    ADD CONSTRAINT problem_patterns_pkey PRIMARY KEY (id);


--
-- Name: problem_patterns problem_patterns_problem_id_pattern_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_patterns
    ADD CONSTRAINT problem_patterns_problem_id_pattern_id_key UNIQUE (problem_id, pattern_id);


--
-- Name: problems problems_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_pkey PRIMARY KEY (id);


--
-- Name: problems problems_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_slug_key UNIQUE (slug);


--
-- Name: program_certificates program_certificates_certificate_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_certificates
    ADD CONSTRAINT program_certificates_certificate_code_key UNIQUE (certificate_code);


--
-- Name: program_certificates program_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_certificates
    ADD CONSTRAINT program_certificates_pkey PRIMARY KEY (id);


--
-- Name: program_enrollments program_enrollments_legacy_source_legacy_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT program_enrollments_legacy_source_legacy_id_key UNIQUE (legacy_source, legacy_id);


--
-- Name: program_enrollments program_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT program_enrollments_pkey PRIMARY KEY (id);


--
-- Name: program_enrollments program_enrollments_program_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT program_enrollments_program_id_user_id_key UNIQUE (program_id, user_id);


--
-- Name: program_reviews program_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_reviews
    ADD CONSTRAINT program_reviews_pkey PRIMARY KEY (id);


--
-- Name: program_stages program_stages_legacy_source_legacy_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_stages
    ADD CONSTRAINT program_stages_legacy_source_legacy_id_key UNIQUE (legacy_source, legacy_id);


--
-- Name: program_stages program_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_stages
    ADD CONSTRAINT program_stages_pkey PRIMARY KEY (id);


--
-- Name: program_stages program_stages_program_id_stage_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_stages
    ADD CONSTRAINT program_stages_program_id_stage_number_key UNIQUE (program_id, stage_number);


--
-- Name: program_submissions program_submissions_legacy_source_legacy_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_submissions
    ADD CONSTRAINT program_submissions_legacy_source_legacy_id_key UNIQUE (legacy_source, legacy_id);


--
-- Name: program_submissions program_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_submissions
    ADD CONSTRAINT program_submissions_pkey PRIMARY KEY (id);


--
-- Name: programs programs_legacy_source_legacy_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_legacy_source_legacy_id_key UNIQUE (legacy_source, legacy_id);


--
-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);


--
-- Name: programs programs_type_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_type_slug_key UNIQUE (type, slug);


--
-- Name: question_groups question_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_groups
    ADD CONSTRAINT question_groups_pkey PRIMARY KEY (id);


--
-- Name: referral_codes referral_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_code_key UNIQUE (code);


--
-- Name: referral_codes referral_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_pkey PRIMARY KEY (id);


--
-- Name: referral_commission_tiers referral_commission_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_commission_tiers
    ADD CONSTRAINT referral_commission_tiers_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_referred_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_user_id_key UNIQUE (referred_user_id);


--
-- Name: courses roadmaps_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT roadmaps_slug_key UNIQUE (slug);


--
-- Name: site_workflows site_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_workflows
    ADD CONSTRAINT site_workflows_pkey PRIMARY KEY (id);


--
-- Name: site_workflows site_workflows_site_id_workflow_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_workflows
    ADD CONSTRAINT site_workflows_site_id_workflow_key_key UNIQUE (site_id, workflow_key);


--
-- Name: sites sites_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_domain_key UNIQUE (domain);


--
-- Name: sites sites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sites
    ADD CONSTRAINT sites_pkey PRIMARY KEY (id);


--
-- Name: step_content step_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_content
    ADD CONSTRAINT step_content_pkey PRIMARY KEY (id);


--
-- Name: step_content step_content_step_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_content
    ADD CONSTRAINT step_content_step_id_key UNIQUE (step_id);


--
-- Name: steps steps_chapter_step_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.steps
    ADD CONSTRAINT steps_chapter_step_unique UNIQUE (chapter_id, step_number);


--
-- Name: steps steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.steps
    ADD CONSTRAINT steps_pkey PRIMARY KEY (id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: submissions submissions_user_id_problem_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_user_id_problem_id_key UNIQUE (user_id, problem_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: test_attempts test_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_pkey PRIMARY KEY (id);


--
-- Name: test_questions test_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT test_questions_pkey PRIMARY KEY (id);


--
-- Name: test_questions test_questions_test_id_question_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT test_questions_test_id_question_id_key UNIQUE (test_id, question_id);


--
-- Name: test_sections test_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_sections
    ADD CONSTRAINT test_sections_pkey PRIMARY KEY (id);


--
-- Name: test_series test_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_series
    ADD CONSTRAINT test_series_pkey PRIMARY KEY (id);


--
-- Name: test_series test_series_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_series
    ADD CONSTRAINT test_series_slug_key UNIQUE (slug);


--
-- Name: tests tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_pkey PRIMARY KEY (id);


--
-- Name: tests tests_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_slug_key UNIQUE (slug);


--
-- Name: testseries_questions testseries_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testseries_questions
    ADD CONSTRAINT testseries_questions_pkey PRIMARY KEY (id);


--
-- Name: user_badges user_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_pkey PRIMARY KEY (id);


--
-- Name: user_badges user_badges_user_id_badge_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id);


--
-- Name: user_chapter_progress user_chapter_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_chapter_progress
    ADD CONSTRAINT user_chapter_progress_pkey PRIMARY KEY (id);


--
-- Name: user_chapter_progress user_chapter_progress_user_id_chapter_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_chapter_progress
    ADD CONSTRAINT user_chapter_progress_user_id_chapter_id_key UNIQUE (user_id, chapter_id);


--
-- Name: user_daily_quests user_daily_quests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_quests
    ADD CONSTRAINT user_daily_quests_pkey PRIMARY KEY (id);


--
-- Name: user_daily_quests user_daily_quests_user_id_quest_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_quests
    ADD CONSTRAINT user_daily_quests_user_id_quest_date_key UNIQUE (user_id, quest_date);


--
-- Name: user_entitlements user_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_entitlements
    ADD CONSTRAINT user_entitlements_pkey PRIMARY KEY (id);


--
-- Name: user_entitlements user_entitlements_user_id_feature_key_resource_type_resourc_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_entitlements
    ADD CONSTRAINT user_entitlements_user_id_feature_key_resource_type_resourc_key UNIQUE (user_id, feature_key, resource_type, resource_id);


--
-- Name: user_files user_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_files
    ADD CONSTRAINT user_files_pkey PRIMARY KEY (id);


--
-- Name: user_memory_profiles user_memory_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memory_profiles
    ADD CONSTRAINT user_memory_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_memory_profiles user_memory_profiles_user_id_profile_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_memory_profiles
    ADD CONSTRAINT user_memory_profiles_user_id_profile_name_key UNIQUE (user_id, profile_name);


--
-- Name: user_notes user_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes
    ADD CONSTRAINT user_notes_pkey PRIMARY KEY (id);


--
-- Name: user_notes user_notes_user_id_problem_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes
    ADD CONSTRAINT user_notes_user_id_problem_id_key UNIQUE (user_id, problem_id);


--
-- Name: user_problem_status user_problem_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_problem_status
    ADD CONSTRAINT user_problem_status_pkey PRIMARY KEY (user_id, problem_id);


--
-- Name: user_progress user_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_pkey PRIMARY KEY (user_id, step_id);


--
-- Name: user_streaks user_streaks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_streaks
    ADD CONSTRAINT user_streaks_pkey PRIMARY KEY (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);


--
-- Name: build_stages_program_short_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX build_stages_program_short_id_idx ON public.build_stages USING btree (program_id, short_id);


--
-- Name: idx_admin_audit_logs_admin_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_logs_admin_time ON public.admin_audit_logs USING btree (admin_id, created_at DESC);


--
-- Name: idx_admin_logs_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_logs_admin ON public.admin_logs USING btree (admin_id, created_at DESC);


--
-- Name: idx_ai_chats_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_chats_user ON public.ai_chats USING btree (user_id, created_at DESC);


--
-- Name: idx_analytics_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_event ON public.analytics_events USING btree (event_name, created_at DESC);


--
-- Name: idx_analytics_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_user ON public.analytics_events USING btree (user_id, created_at DESC);


--
-- Name: idx_app_certificates_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_certificates_user ON public.apprenticeship_certificates USING btree (user_id);


--
-- Name: idx_app_certificates_verification; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_certificates_verification ON public.apprenticeship_certificates USING btree (verification_code);


--
-- Name: idx_app_coupons_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_coupons_code ON public.apprenticeship_coupons USING btree (code);


--
-- Name: idx_app_github_connections_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_github_connections_user ON public.apprenticeship_github_connections USING btree (user_id);


--
-- Name: idx_app_post_replies_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_post_replies_post ON public.apprenticeship_post_replies USING btree (post_id);


--
-- Name: idx_app_posts_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_posts_program ON public.apprenticeship_posts USING btree (program_id);


--
-- Name: idx_app_posts_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_posts_project ON public.apprenticeship_posts USING btree (project_id);


--
-- Name: idx_app_project_progress_enrollment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_project_progress_enrollment ON public.apprenticeship_project_progress USING btree (enrollment_id);


--
-- Name: idx_app_project_progress_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_project_progress_user ON public.apprenticeship_project_progress USING btree (user_id);


--
-- Name: idx_app_submissions_enrollment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_submissions_enrollment ON public.apprenticeship_submissions USING btree (enrollment_id);


--
-- Name: idx_app_submissions_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_submissions_project ON public.apprenticeship_submissions USING btree (project_id);


--
-- Name: idx_app_submissions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_submissions_status ON public.apprenticeship_submissions USING btree (verification_status);


--
-- Name: idx_app_submissions_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_submissions_submitted_at ON public.apprenticeship_submissions USING btree (submitted_at DESC);


--
-- Name: idx_app_submissions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_submissions_user ON public.apprenticeship_submissions USING btree (user_id);


--
-- Name: idx_app_test_stages_submission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_app_test_stages_submission ON public.apprenticeship_test_stages USING btree (submission_id);


--
-- Name: idx_apprenticeship_enrollments_program_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apprenticeship_enrollments_program_id ON public.apprenticeship_enrollments USING btree (program_id);


--
-- Name: idx_apprenticeship_enrollments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apprenticeship_enrollments_status ON public.apprenticeship_enrollments USING btree (status);


--
-- Name: idx_apprenticeship_enrollments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apprenticeship_enrollments_user_id ON public.apprenticeship_enrollments USING btree (user_id);


--
-- Name: idx_apprenticeship_events_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apprenticeship_events_category ON public.apprenticeship_events USING btree (event_category);


--
-- Name: idx_apprenticeship_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apprenticeship_events_created_at ON public.apprenticeship_events USING btree (created_at DESC);


--
-- Name: idx_apprenticeship_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apprenticeship_events_event_type ON public.apprenticeship_events USING btree (event_type);


--
-- Name: idx_apprenticeship_events_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apprenticeship_events_session ON public.apprenticeship_events USING btree (session_id);


--
-- Name: idx_apprenticeship_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apprenticeship_events_user_id ON public.apprenticeship_events USING btree (user_id);


--
-- Name: idx_apprenticeship_programs_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apprenticeship_programs_slug ON public.apprenticeship_programs USING btree (slug);


--
-- Name: idx_apprenticeship_programs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apprenticeship_programs_status ON public.apprenticeship_programs USING btree (status);


--
-- Name: idx_apprenticeship_projects_program_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apprenticeship_projects_program_id ON public.apprenticeship_projects USING btree (program_id);


--
-- Name: idx_apprenticeship_projects_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_apprenticeship_projects_sort_order ON public.apprenticeship_projects USING btree (program_id, sort_order);


--
-- Name: idx_bcl_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bcl_program ON public.build_challenge_languages USING btree (program_id);


--
-- Name: idx_bsr_enrollment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bsr_enrollment ON public.build_stage_results USING btree (enrollment_id);


--
-- Name: idx_bsr_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bsr_stage ON public.build_stage_results USING btree (stage_id);


--
-- Name: idx_bsr_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bsr_user ON public.build_stage_results USING btree (user_id);


--
-- Name: idx_build_enrollments_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_enrollments_deleted_at ON public.build_enrollments USING btree (deleted_at);


--
-- Name: idx_build_enrollments_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_enrollments_mode ON public.build_enrollments USING btree (build_mode);


--
-- Name: idx_build_enrollments_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_enrollments_program ON public.build_enrollments USING btree (program_id);


--
-- Name: idx_build_enrollments_repo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_enrollments_repo ON public.build_enrollments USING btree (repo_full_name);


--
-- Name: idx_build_enrollments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_enrollments_user ON public.build_enrollments USING btree (user_id);


--
-- Name: idx_build_languages_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_languages_program ON public.build_challenge_languages USING btree (program_id);


--
-- Name: idx_build_results_enrollment_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_results_enrollment_stage ON public.build_stage_results USING btree (enrollment_id, stage_id);


--
-- Name: idx_build_results_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_results_user ON public.build_stage_results USING btree (user_id, created_at DESC);


--
-- Name: idx_build_stages_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_stages_active ON public.build_stages USING btree (program_id, is_active) WHERE (is_active = true);


--
-- Name: idx_build_stages_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_stages_deleted_at ON public.build_stages USING btree (deleted_at);


--
-- Name: idx_build_stages_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_stages_program ON public.build_stages USING btree (program_id);


--
-- Name: idx_build_stages_program_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_stages_program_number ON public.build_stages USING btree (program_id, stage_number);


--
-- Name: idx_build_stages_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_stages_sort ON public.build_stages USING btree (program_id, sort_order);


--
-- Name: idx_build_stages_verification_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_build_stages_verification_type ON public.build_stages USING btree (verification_type);


--
-- Name: idx_categories_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_order ON public.categories USING btree (order_index);


--
-- Name: idx_categories_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_categories_slug ON public.categories USING btree (slug);


--
-- Name: idx_certificates_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_code ON public.certificates USING btree (verification_code);


--
-- Name: idx_certificates_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_certificates_user ON public.certificates USING btree (user_id);


--
-- Name: idx_chapters_roadmap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chapters_roadmap ON public.chapters USING btree (course_id);


--
-- Name: idx_cib_status_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cib_status_type ON public.content_import_batches USING btree (content_type, status, created_at DESC);


--
-- Name: idx_cib_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cib_uploaded_by ON public.content_import_batches USING btree (uploaded_by, created_at DESC);


--
-- Name: idx_cir_batch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cir_batch ON public.content_import_rows USING btree (batch_id, row_number);


--
-- Name: idx_cir_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cir_status ON public.content_import_rows USING btree (batch_id, status);


--
-- Name: idx_coupon_usages_coupon; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupon_usages_coupon ON public.coupon_usages USING btree (coupon_id);


--
-- Name: idx_coupon_usages_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupon_usages_user ON public.coupon_usages USING btree (user_id);


--
-- Name: idx_coupons_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_active ON public.coupons USING btree (is_active);


--
-- Name: idx_coupons_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coupons_code ON public.coupons USING btree (code);


--
-- Name: idx_course_enrollments_course_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_enrollments_course_id ON public.course_enrollments USING btree (course_id);


--
-- Name: idx_course_enrollments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_course_enrollments_user_id ON public.course_enrollments USING btree (user_id);


--
-- Name: idx_courses_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_courses_deleted_at ON public.courses USING btree (deleted_at);


--
-- Name: idx_cpa_content; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpa_content ON public.content_plan_assignments USING btree (content_type, content_id);


--
-- Name: idx_cpa_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpa_feature ON public.content_plan_assignments USING btree (plan_id, feature_key);


--
-- Name: idx_cpa_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cpa_plan ON public.content_plan_assignments USING btree (plan_id);


--
-- Name: idx_feedback_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_status ON public.feedback USING btree (status);


--
-- Name: idx_feedback_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_user ON public.feedback USING btree (user_id);


--
-- Name: idx_idempotency_keys_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_idempotency_keys_expires_at ON public.idempotency_keys USING btree (expires_at);


--
-- Name: idx_job_alerts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_alerts_active ON public.job_alerts USING btree (is_active, posted_at DESC);


--
-- Name: idx_job_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_logs_status ON public.job_logs USING btree (status);


--
-- Name: idx_job_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_job_logs_user_id ON public.job_logs USING btree (user_id);


--
-- Name: idx_patterns_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patterns_category ON public.patterns USING btree (category_id);


--
-- Name: idx_patterns_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patterns_slug ON public.patterns USING btree (slug);


--
-- Name: idx_payments_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_created ON public.payments USING btree (created_at DESC);


--
-- Name: idx_payments_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_plan ON public.payments USING btree (plan_id);


--
-- Name: idx_payments_razorpay_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_razorpay_order ON public.payments USING btree (razorpay_order_id);


--
-- Name: idx_payments_razorpay_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_razorpay_payment ON public.payments USING btree (razorpay_payment_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_payments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_user ON public.payments USING btree (user_id);


--
-- Name: idx_plan_entitlements_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_entitlements_feature ON public.plan_entitlements USING btree (feature_key);


--
-- Name: idx_plan_entitlements_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_entitlements_plan ON public.plan_entitlements USING btree (plan_id);


--
-- Name: idx_plans_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_active ON public.plans USING btree (is_active);


--
-- Name: idx_plans_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_slug ON public.plans USING btree (slug);


--
-- Name: idx_plans_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_sort ON public.plans USING btree (sort_order);


--
-- Name: idx_pp_pattern; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pp_pattern ON public.problem_patterns USING btree (pattern_id);


--
-- Name: idx_pp_problem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pp_problem ON public.problem_patterns USING btree (problem_id);


--
-- Name: idx_problems_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_problems_deleted_at ON public.problems USING btree (deleted_at);


--
-- Name: idx_problems_difficulty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_problems_difficulty ON public.problems USING btree (difficulty);


--
-- Name: idx_problems_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_problems_order ON public.problems USING btree (order_index);


--
-- Name: idx_problems_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_problems_search ON public.problems USING gin (search_vector);


--
-- Name: idx_problems_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_problems_slug ON public.problems USING btree (slug);


--
-- Name: idx_problems_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_problems_topic ON public.problems USING btree (topic);


--
-- Name: idx_program_enrollments_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_enrollments_deleted_at ON public.program_enrollments USING btree (deleted_at);


--
-- Name: idx_program_enrollments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_enrollments_user ON public.program_enrollments USING btree (user_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_program_stages_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_stages_deleted_at ON public.program_stages USING btree (deleted_at);


--
-- Name: idx_program_stages_program_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_stages_program_number ON public.program_stages USING btree (program_id, stage_number) WHERE (deleted_at IS NULL);


--
-- Name: idx_program_submissions_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_submissions_deleted_at ON public.program_submissions USING btree (deleted_at);


--
-- Name: idx_program_submissions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_submissions_user ON public.program_submissions USING btree (user_id, submitted_at DESC) WHERE (deleted_at IS NULL);


--
-- Name: idx_programs_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_programs_category_id ON public.programs USING btree (category_id);


--
-- Name: idx_programs_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_programs_deleted_at ON public.programs USING btree (deleted_at);


--
-- Name: idx_programs_program_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_programs_program_type ON public.apprenticeship_programs USING btree (program_type);


--
-- Name: idx_programs_type_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_programs_type_active ON public.programs USING btree (type, is_active) WHERE (deleted_at IS NULL);


--
-- Name: idx_referral_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_codes_code ON public.referral_codes USING btree (code);


--
-- Name: idx_referral_codes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referral_codes_user ON public.referral_codes USING btree (user_id);


--
-- Name: idx_referrals_credit_eligible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_credit_eligible ON public.referrals USING btree (credit_eligible_at) WHERE (status = 'pending'::public.referral_status);


--
-- Name: idx_referrals_referred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referred ON public.referrals USING btree (referred_user_id);


--
-- Name: idx_referrals_referrer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referrer ON public.referrals USING btree (referrer_id);


--
-- Name: idx_referrals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_status ON public.referrals USING btree (status);


--
-- Name: idx_roadmap_items_roadmap; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roadmap_items_roadmap ON public.course_items USING btree (course_id, order_index);


--
-- Name: idx_roadmaps_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roadmaps_slug ON public.courses USING btree (slug);


--
-- Name: idx_roadmaps_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roadmaps_type ON public.courses USING btree (type);


--
-- Name: idx_site_workflows_site_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_workflows_site_id ON public.site_workflows USING btree (site_id);


--
-- Name: idx_steps_chapter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_steps_chapter ON public.steps USING btree (chapter_id, step_number);


--
-- Name: idx_submissions_problem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_problem ON public.submissions USING btree (problem_id);


--
-- Name: idx_submissions_solved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_solved ON public.submissions USING btree (user_id, solved);


--
-- Name: idx_submissions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_submissions_user ON public.submissions USING btree (user_id);


--
-- Name: idx_subscriptions_period_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_period_end ON public.subscriptions USING btree (current_period_end);


--
-- Name: idx_subscriptions_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_plan ON public.subscriptions USING btree (plan_id);


--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);


--
-- Name: idx_subscriptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user ON public.subscriptions USING btree (user_id);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (user_id, status);


--
-- Name: idx_tasks_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_user ON public.tasks USING btree (user_id);


--
-- Name: idx_tasks_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_user_date ON public.tasks USING btree (user_id, due_date);


--
-- Name: idx_test_attempts_user_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_test_attempts_user_test ON public.test_attempts USING btree (user_id, test_id, created_at DESC);


--
-- Name: idx_test_questions_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_test_questions_test ON public.test_questions USING btree (test_id, sort_order);


--
-- Name: idx_test_sections_test; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_test_sections_test ON public.test_sections USING btree (test_id, sort_order);


--
-- Name: idx_test_series_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_test_series_category ON public.test_series USING btree (exam_category_id);


--
-- Name: idx_tests_series; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tests_series ON public.tests USING btree (test_series_id, sort_order);


--
-- Name: idx_testseries_questions_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_testseries_questions_topic ON public.testseries_questions USING btree (topic);


--
-- Name: idx_ucp_chapter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ucp_chapter ON public.user_chapter_progress USING btree (chapter_id);


--
-- Name: idx_ucp_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ucp_user ON public.user_chapter_progress USING btree (user_id);


--
-- Name: idx_user_daily_quests_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_daily_quests_user_date ON public.user_daily_quests USING btree (user_id, quest_date DESC);


--
-- Name: idx_user_entitlements_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_entitlements_expires ON public.user_entitlements USING btree (expires_at);


--
-- Name: idx_user_entitlements_feature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_entitlements_feature ON public.user_entitlements USING btree (feature_key);


--
-- Name: idx_user_entitlements_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_entitlements_resource ON public.user_entitlements USING btree (resource_type, resource_id);


--
-- Name: idx_user_entitlements_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_entitlements_user ON public.user_entitlements USING btree (user_id);


--
-- Name: idx_user_files_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_files_user_id ON public.user_files USING btree (user_id);


--
-- Name: idx_user_notes_problem_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notes_problem_id ON public.user_notes USING btree (problem_id);


--
-- Name: idx_user_notes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notes_user_id ON public.user_notes USING btree (user_id);


--
-- Name: idx_user_problem_status_problem_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_problem_status_problem_id ON public.user_problem_status USING btree (problem_id);


--
-- Name: idx_user_problem_status_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_problem_status_user_id ON public.user_problem_status USING btree (user_id);


--
-- Name: idx_users_career_track; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_career_track ON public.users USING btree (career_track);


--
-- Name: idx_users_college; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_college ON public.users USING btree (college_name);


--
-- Name: idx_users_current_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_current_plan ON public.users USING btree (current_plan);


--
-- Name: idx_users_onboarding_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_onboarding_completed ON public.users USING btree (onboarding_completed);


--
-- Name: idx_users_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_phone ON public.users USING btree (phone);


--
-- Name: idx_users_referral_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_referral_code ON public.users USING btree (referral_code);


--
-- Name: idx_users_referred_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_referred_by ON public.users USING btree (referred_by);


--
-- Name: idx_users_study_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_study_time ON public.users USING btree (study_time_total DESC);


--
-- Name: idx_withdrawals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawals_status ON public.withdrawals USING btree (status);


--
-- Name: idx_withdrawals_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawals_user ON public.withdrawals USING btree (user_id);


--
-- Name: uq_test_attempts_in_progress; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_test_attempts_in_progress ON public.test_attempts USING btree (user_id, test_id) WHERE (status = 'in_progress'::text);


--
-- Name: build_enrollments build_enrollments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER build_enrollments_updated_at BEFORE UPDATE ON public.build_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: build_stages build_stages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER build_stages_updated_at BEFORE UPDATE ON public.build_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: categories categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: feedback feedback_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER feedback_updated_at BEFORE UPDATE ON public.feedback FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: patterns patterns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER patterns_updated_at BEFORE UPDATE ON public.patterns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: problems problems_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER problems_updated_at BEFORE UPDATE ON public.problems FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: courses roadmaps_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER roadmaps_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: build_enrollments set_build_enrollments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_build_enrollments_updated_at BEFORE UPDATE ON public.build_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: build_stages set_build_stages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_build_stages_updated_at BEFORE UPDATE ON public.build_stages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tasks tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: apprenticeship_project_progress trg_app_project_progress_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_app_project_progress_updated_at BEFORE UPDATE ON public.apprenticeship_project_progress FOR EACH ROW EXECUTE FUNCTION public.update_apprenticeship_updated_at();


--
-- Name: apprenticeship_enrollments trg_apprenticeship_enrollments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_apprenticeship_enrollments_updated_at BEFORE UPDATE ON public.apprenticeship_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_apprenticeship_updated_at();


--
-- Name: apprenticeship_programs trg_apprenticeship_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_apprenticeship_programs_updated_at BEFORE UPDATE ON public.apprenticeship_programs FOR EACH ROW EXECUTE FUNCTION public.update_apprenticeship_updated_at();


--
-- Name: apprenticeship_projects trg_apprenticeship_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_apprenticeship_projects_updated_at BEFORE UPDATE ON public.apprenticeship_projects FOR EACH ROW EXECUTE FUNCTION public.update_apprenticeship_updated_at();


--
-- Name: exam_categories trg_exam_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_exam_categories_updated_at BEFORE UPDATE ON public.exam_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: test_attempts trg_test_attempts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_test_attempts_updated_at BEFORE UPDATE ON public.test_attempts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: test_series trg_test_series_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_test_series_updated_at BEFORE UPDATE ON public.test_series FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: tests trg_tests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tests_updated_at BEFORE UPDATE ON public.tests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: testseries_questions trg_testseries_questions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_testseries_questions_updated_at BEFORE UPDATE ON public.testseries_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: coupons update_coupons_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: payments update_payments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: plan_entitlements update_plan_entitlements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_plan_entitlements_updated_at BEFORE UPDATE ON public.plan_entitlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: plans update_plans_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: referral_codes update_referral_codes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_referral_codes_updated_at BEFORE UPDATE ON public.referral_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: referral_commission_tiers update_referral_commission_tiers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_referral_commission_tiers_updated_at BEFORE UPDATE ON public.referral_commission_tiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: referrals update_referrals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: user_entitlements update_user_entitlements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_entitlements_updated_at BEFORE UPDATE ON public.user_entitlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: withdrawals update_withdrawals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_withdrawals_updated_at BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: users users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: admin_logs admin_logs_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_logs
    ADD CONSTRAINT admin_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id);


--
-- Name: admin_permissions admin_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_permissions
    ADD CONSTRAINT admin_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.admin_roles(id) ON DELETE CASCADE;


--
-- Name: ai_chats ai_chats_problem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chats
    ADD CONSTRAINT ai_chats_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id);


--
-- Name: ai_chats ai_chats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_chats
    ADD CONSTRAINT ai_chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: analytics_events analytics_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: apprenticeship_certificates apprenticeship_certificates_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_certificates
    ADD CONSTRAINT apprenticeship_certificates_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.apprenticeship_enrollments(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_certificates apprenticeship_certificates_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_certificates
    ADD CONSTRAINT apprenticeship_certificates_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.apprenticeship_programs(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_certificates apprenticeship_certificates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_certificates
    ADD CONSTRAINT apprenticeship_certificates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_coupons apprenticeship_coupons_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_coupons
    ADD CONSTRAINT apprenticeship_coupons_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: apprenticeship_coupons apprenticeship_coupons_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_coupons
    ADD CONSTRAINT apprenticeship_coupons_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.apprenticeship_programs(id) ON DELETE SET NULL;


--
-- Name: apprenticeship_enrollments apprenticeship_enrollments_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_enrollments
    ADD CONSTRAINT apprenticeship_enrollments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.apprenticeship_programs(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_enrollments apprenticeship_enrollments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_enrollments
    ADD CONSTRAINT apprenticeship_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_github_connections apprenticeship_github_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_github_connections
    ADD CONSTRAINT apprenticeship_github_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_post_replies apprenticeship_post_replies_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_post_replies
    ADD CONSTRAINT apprenticeship_post_replies_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.apprenticeship_posts(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_post_replies apprenticeship_post_replies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_post_replies
    ADD CONSTRAINT apprenticeship_post_replies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_post_upvotes apprenticeship_post_upvotes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_post_upvotes
    ADD CONSTRAINT apprenticeship_post_upvotes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.apprenticeship_posts(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_post_upvotes apprenticeship_post_upvotes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_post_upvotes
    ADD CONSTRAINT apprenticeship_post_upvotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_posts apprenticeship_posts_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_posts
    ADD CONSTRAINT apprenticeship_posts_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.apprenticeship_programs(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_posts apprenticeship_posts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_posts
    ADD CONSTRAINT apprenticeship_posts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.apprenticeship_projects(id) ON DELETE SET NULL;


--
-- Name: apprenticeship_posts apprenticeship_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_posts
    ADD CONSTRAINT apprenticeship_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_project_progress apprenticeship_project_progress_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_project_progress
    ADD CONSTRAINT apprenticeship_project_progress_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.apprenticeship_enrollments(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_project_progress apprenticeship_project_progress_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_project_progress
    ADD CONSTRAINT apprenticeship_project_progress_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.apprenticeship_projects(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_project_progress apprenticeship_project_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_project_progress
    ADD CONSTRAINT apprenticeship_project_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_projects apprenticeship_projects_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_projects
    ADD CONSTRAINT apprenticeship_projects_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.apprenticeship_programs(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_submissions apprenticeship_submissions_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_submissions
    ADD CONSTRAINT apprenticeship_submissions_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.apprenticeship_enrollments(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_submissions apprenticeship_submissions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_submissions
    ADD CONSTRAINT apprenticeship_submissions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.apprenticeship_projects(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_submissions apprenticeship_submissions_project_progress_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_submissions
    ADD CONSTRAINT apprenticeship_submissions_project_progress_id_fkey FOREIGN KEY (project_progress_id) REFERENCES public.apprenticeship_project_progress(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_submissions apprenticeship_submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_submissions
    ADD CONSTRAINT apprenticeship_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: apprenticeship_test_stages apprenticeship_test_stages_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.apprenticeship_test_stages
    ADD CONSTRAINT apprenticeship_test_stages_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.apprenticeship_submissions(id) ON DELETE CASCADE;


--
-- Name: build_challenge_languages build_challenge_languages_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_challenge_languages
    ADD CONSTRAINT build_challenge_languages_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.apprenticeship_programs(id) ON DELETE CASCADE;


--
-- Name: build_enrollments build_enrollments_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_enrollments
    ADD CONSTRAINT build_enrollments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.apprenticeship_programs(id) ON DELETE CASCADE;


--
-- Name: build_enrollments build_enrollments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_enrollments
    ADD CONSTRAINT build_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: build_stage_results build_stage_results_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_stage_results
    ADD CONSTRAINT build_stage_results_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.build_enrollments(id) ON DELETE CASCADE;


--
-- Name: build_stage_results build_stage_results_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_stage_results
    ADD CONSTRAINT build_stage_results_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.build_stages(id) ON DELETE CASCADE;


--
-- Name: build_stage_results build_stage_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_stage_results
    ADD CONSTRAINT build_stage_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: build_stages build_stages_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.build_stages
    ADD CONSTRAINT build_stages_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.apprenticeship_programs(id) ON DELETE CASCADE;


--
-- Name: certificates certificates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chapter_content chapter_content_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapter_content
    ADD CONSTRAINT chapter_content_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: chapters chapters_roadmap_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chapters
    ADD CONSTRAINT chapters_roadmap_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: content_import_batches content_import_batches_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_import_batches
    ADD CONSTRAINT content_import_batches_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: content_import_rows content_import_rows_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_import_rows
    ADD CONSTRAINT content_import_rows_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.content_import_batches(id) ON DELETE CASCADE;


--
-- Name: content_plan_assignments content_plan_assignments_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_plan_assignments
    ADD CONSTRAINT content_plan_assignments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: coupon_usages coupon_usages_coupon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE;


--
-- Name: coupon_usages coupon_usages_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id);


--
-- Name: coupon_usages coupon_usages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_usages
    ADD CONSTRAINT coupon_usages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: coupons coupons_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupons
    ADD CONSTRAINT coupons_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: course_enrollments course_enrollments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_enrollments course_enrollments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_enrollments
    ADD CONSTRAINT course_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: courses courses_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: feedback feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks fk_tasks_roadmap; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT fk_tasks_roadmap FOREIGN KEY (roadmap_id) REFERENCES public.courses(id) ON DELETE SET NULL;


--
-- Name: patterns patterns_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patterns
    ADD CONSTRAINT patterns_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: payments payments_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: payments payments_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: phases phases_roadmap_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phases
    ADD CONSTRAINT phases_roadmap_id_fkey FOREIGN KEY (roadmap_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: plan_entitlements plan_entitlements_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_entitlements
    ADD CONSTRAINT plan_entitlements_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;


--
-- Name: problem_patterns problem_patterns_pattern_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_patterns
    ADD CONSTRAINT problem_patterns_pattern_id_fkey FOREIGN KEY (pattern_id) REFERENCES public.patterns(id) ON DELETE CASCADE;


--
-- Name: problem_patterns problem_patterns_problem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problem_patterns
    ADD CONSTRAINT problem_patterns_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE CASCADE;


--
-- Name: problems problems_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.problems
    ADD CONSTRAINT problems_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: program_certificates program_certificates_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_certificates
    ADD CONSTRAINT program_certificates_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.program_enrollments(id) ON DELETE SET NULL;


--
-- Name: program_certificates program_certificates_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_certificates
    ADD CONSTRAINT program_certificates_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;


--
-- Name: program_enrollments program_enrollments_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT program_enrollments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;


--
-- Name: program_reviews program_reviews_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_reviews
    ADD CONSTRAINT program_reviews_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.program_submissions(id) ON DELETE CASCADE;


--
-- Name: program_stages program_stages_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_stages
    ADD CONSTRAINT program_stages_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;


--
-- Name: program_submissions program_submissions_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_submissions
    ADD CONSTRAINT program_submissions_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.program_enrollments(id) ON DELETE CASCADE;


--
-- Name: program_submissions program_submissions_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_submissions
    ADD CONSTRAINT program_submissions_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;


--
-- Name: program_submissions program_submissions_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_submissions
    ADD CONSTRAINT program_submissions_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.program_stages(id) ON DELETE SET NULL;


--
-- Name: referral_codes referral_codes_created_by_admin_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_created_by_admin_fkey FOREIGN KEY (created_by_admin) REFERENCES public.users(id);


--
-- Name: referral_codes referral_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referral_codes
    ADD CONSTRAINT referral_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referral_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referral_code_id_fkey FOREIGN KEY (referral_code_id) REFERENCES public.referral_codes(id);


--
-- Name: referrals referrals_referred_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_user_id_fkey FOREIGN KEY (referred_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: course_items roadmap_items_problem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_items
    ADD CONSTRAINT roadmap_items_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE SET NULL;


--
-- Name: course_items roadmap_items_roadmap_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_items
    ADD CONSTRAINT roadmap_items_roadmap_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: courses roadmaps_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT roadmaps_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: step_content step_content_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_content
    ADD CONSTRAINT step_content_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.steps(id) ON DELETE CASCADE;


--
-- Name: steps steps_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.steps
    ADD CONSTRAINT steps_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_problem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_problem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: test_attempts test_attempts_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;


--
-- Name: test_attempts test_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_attempts
    ADD CONSTRAINT test_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: test_questions test_questions_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT test_questions_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.testseries_questions(id) ON DELETE CASCADE;


--
-- Name: test_questions test_questions_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT test_questions_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.test_sections(id) ON DELETE SET NULL;


--
-- Name: test_questions test_questions_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_questions
    ADD CONSTRAINT test_questions_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;


--
-- Name: test_sections test_sections_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_sections
    ADD CONSTRAINT test_sections_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;


--
-- Name: test_series test_series_exam_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_series
    ADD CONSTRAINT test_series_exam_category_id_fkey FOREIGN KEY (exam_category_id) REFERENCES public.exam_categories(id) ON DELETE CASCADE;


--
-- Name: tests tests_test_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_test_series_id_fkey FOREIGN KEY (test_series_id) REFERENCES public.test_series(id) ON DELETE CASCADE;


--
-- Name: testseries_questions testseries_questions_question_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testseries_questions
    ADD CONSTRAINT testseries_questions_question_group_id_fkey FOREIGN KEY (question_group_id) REFERENCES public.question_groups(id) ON DELETE SET NULL;


--
-- Name: user_badges user_badges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_chapter_progress user_chapter_progress_chapter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_chapter_progress
    ADD CONSTRAINT user_chapter_progress_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id) ON DELETE CASCADE;


--
-- Name: user_chapter_progress user_chapter_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_chapter_progress
    ADD CONSTRAINT user_chapter_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_daily_quests user_daily_quests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_quests
    ADD CONSTRAINT user_daily_quests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_entitlements user_entitlements_source_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_entitlements
    ADD CONSTRAINT user_entitlements_source_payment_id_fkey FOREIGN KEY (source_payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: user_entitlements user_entitlements_source_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_entitlements
    ADD CONSTRAINT user_entitlements_source_subscription_id_fkey FOREIGN KEY (source_subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;


--
-- Name: user_entitlements user_entitlements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_entitlements
    ADD CONSTRAINT user_entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_notes user_notes_problem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes
    ADD CONSTRAINT user_notes_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE CASCADE;


--
-- Name: user_notes user_notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notes
    ADD CONSTRAINT user_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_problem_status user_problem_status_problem_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_problem_status
    ADD CONSTRAINT user_problem_status_problem_id_fkey FOREIGN KEY (problem_id) REFERENCES public.problems(id) ON DELETE CASCADE;


--
-- Name: user_problem_status user_problem_status_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_problem_status
    ADD CONSTRAINT user_problem_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_progress user_progress_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_step_id_fkey FOREIGN KEY (step_id) REFERENCES public.steps(id) ON DELETE CASCADE;


--
-- Name: user_progress user_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_streaks user_streaks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_streaks
    ADD CONSTRAINT user_streaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: users users_admin_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_admin_role_id_fkey FOREIGN KEY (admin_role_id) REFERENCES public.admin_roles(id) ON DELETE SET NULL;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: users users_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.users(id);


--
-- Name: withdrawals withdrawals_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id);


--
-- Name: withdrawals withdrawals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: build_challenge_languages Admins can manage build challenge languages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage build challenge languages" ON public.build_challenge_languages TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));


--
-- Name: build_stages Admins can manage build stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage build stages" ON public.build_stages TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));


--
-- Name: build_stages Anyone can read active build stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read active build stages" ON public.build_stages FOR SELECT USING ((is_active = true));


--
-- Name: build_challenge_languages Anyone can read build challenge languages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read build challenge languages" ON public.build_challenge_languages FOR SELECT USING (true);


--
-- Name: exam_categories Public read active exam categories; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read active exam categories" ON public.exam_categories FOR SELECT USING ((is_active = true));


--
-- Name: test_series Public read published test series; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read published test series" ON public.test_series FOR SELECT USING (((is_published = true) AND (deleted_at IS NULL)));


--
-- Name: tests Public read published tests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read published tests" ON public.tests FOR SELECT USING (((is_published = true) AND (deleted_at IS NULL) AND ((release_at IS NULL) OR (release_at <= now()))));


--
-- Name: apprenticeship_enrollments Service role can manage all enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all enrollments" ON public.apprenticeship_enrollments USING ((auth.role() = 'service_role'::text));


--
-- Name: apprenticeship_project_progress Service role can manage all project progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all project progress" ON public.apprenticeship_project_progress USING ((auth.role() = 'service_role'::text));


--
-- Name: apprenticeship_submissions Service role can manage all submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all submissions" ON public.apprenticeship_submissions USING ((auth.role() = 'service_role'::text));


--
-- Name: ai_chats Users can create own chats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own chats" ON public.ai_chats FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: build_enrollments Users can insert own build enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own build enrollments" ON public.build_enrollments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: submissions Users can insert own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own submissions" ON public.submissions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: course_enrollments Users can insert their own enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own enrollments" ON public.course_enrollments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_notes Users can insert their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own notes" ON public.user_notes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_problem_status Users can insert their own problem status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own problem status" ON public.user_problem_status FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: feedback Users can manage own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own feedback" ON public.feedback USING ((auth.uid() = user_id));


--
-- Name: tasks Users can manage own tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own tasks" ON public.tasks USING ((auth.uid() = user_id));


--
-- Name: build_enrollments Users can read own build enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own build enrollments" ON public.build_enrollments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: build_stage_results Users can read own build stage results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own build stage results" ON public.build_stage_results FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: build_enrollments Users can update own build enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own build enrollments" ON public.build_enrollments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: users Users can update own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING ((auth.uid() = id));


--
-- Name: course_enrollments Users can update their own enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own enrollments" ON public.course_enrollments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_notes Users can update their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notes" ON public.user_notes FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_problem_status Users can update their own problem status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own problem status" ON public.user_problem_status FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: tasks Users can view admin-assigned tasks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view admin-assigned tasks" ON public.tasks FOR SELECT USING (((is_admin_assigned = true) AND (auth.uid() = user_id)));


--
-- Name: certificates Users can view own certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own certificates" ON public.certificates FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ai_chats Users can view own chats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own chats" ON public.ai_chats FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: users Users can view own data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own data" ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_entitlements Users can view own entitlements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own entitlements" ON public.user_entitlements FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: submissions Users can view own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own submissions" ON public.submissions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: apprenticeship_enrollments Users can view their own enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own enrollments" ON public.apprenticeship_enrollments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: course_enrollments Users can view their own enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own enrollments" ON public.course_enrollments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_notes Users can view their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notes" ON public.user_notes FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_problem_status Users can view their own problem status; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own problem status" ON public.user_problem_status FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: apprenticeship_project_progress Users can view their own project progress; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own project progress" ON public.apprenticeship_project_progress FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: apprenticeship_submissions Users can view their own submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own submissions" ON public.apprenticeship_submissions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: test_attempts Users manage own attempts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own attempts" ON public.test_attempts USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: content_import_rows admin delete own import rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin delete own import rows" ON public.content_import_rows FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.content_import_batches b
  WHERE ((b.id = content_import_rows.batch_id) AND (b.uploaded_by = auth.uid())))));


--
-- Name: content_import_rows admin insert own import rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin insert own import rows" ON public.content_import_rows FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.content_import_batches b
  WHERE ((b.id = content_import_rows.batch_id) AND (b.uploaded_by = auth.uid())))));


--
-- Name: content_import_batches admin manage own import batches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin manage own import batches" ON public.content_import_batches USING ((auth.uid() = uploaded_by));


--
-- Name: content_import_rows admin read own import rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin read own import rows" ON public.content_import_rows FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.content_import_batches b
  WHERE ((b.id = content_import_rows.batch_id) AND (b.uploaded_by = auth.uid())))));


--
-- Name: content_import_rows admin update own import rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin update own import rows" ON public.content_import_rows FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.content_import_batches b
  WHERE ((b.id = content_import_rows.batch_id) AND (b.uploaded_by = auth.uid())))));


--
-- Name: admin_audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_chats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;

--
-- Name: apprenticeship_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.apprenticeship_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: apprenticeship_project_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.apprenticeship_project_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: apprenticeship_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.apprenticeship_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: build_challenge_languages build languages public read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "build languages public read" ON public.build_challenge_languages FOR SELECT USING (true);


--
-- Name: build_stages build stages public read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "build stages public read" ON public.build_stages FOR SELECT USING ((is_active = true));


--
-- Name: build_challenge_languages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.build_challenge_languages ENABLE ROW LEVEL SECURITY;

--
-- Name: build_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.build_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: build_stage_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.build_stage_results ENABLE ROW LEVEL SECURITY;

--
-- Name: build_stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.build_stages ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: categories categories public read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);


--
-- Name: certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_commission_tiers commission_tiers_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commission_tiers_admin_all ON public.referral_commission_tiers USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))));


--
-- Name: referral_commission_tiers commission_tiers_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY commission_tiers_public_read ON public.referral_commission_tiers FOR SELECT USING ((is_active = true));


--
-- Name: content_import_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_import_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: content_import_rows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_import_rows ENABLE ROW LEVEL SECURITY;

--
-- Name: content_plan_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_plan_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: coupon_usages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

--
-- Name: coupon_usages coupon_usages_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY coupon_usages_admin_all ON public.coupon_usages USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))));


--
-- Name: coupon_usages coupon_usages_user_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY coupon_usages_user_read ON public.coupon_usages FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: coupons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

--
-- Name: coupons coupons_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY coupons_admin_all ON public.coupons USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))));


--
-- Name: coupons coupons_authenticated_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY coupons_authenticated_read ON public.coupons FOR SELECT USING (((is_active = true) AND (auth.uid() IS NOT NULL)));


--
-- Name: course_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: content_plan_assignments cpa_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cpa_admin_write ON public.content_plan_assignments USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))) WITH CHECK ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))));


--
-- Name: content_plan_assignments cpa_read_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cpa_read_authenticated ON public.content_plan_assignments FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: plan_entitlements entitlements_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY entitlements_admin_all ON public.plan_entitlements USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))));


--
-- Name: plan_entitlements entitlements_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY entitlements_public_read ON public.plan_entitlements FOR SELECT USING (true);


--
-- Name: exam_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.exam_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: idempotency_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: payments payments_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_admin_all ON public.payments USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))));


--
-- Name: payments payments_user_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payments_user_read ON public.payments FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: plan_entitlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;

--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: plans plans_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_admin_all ON public.plans USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))));


--
-- Name: plans plans_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_public_read ON public.plans FOR SELECT USING ((is_active = true));


--
-- Name: program_stages program stages public read active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "program stages public read active" ON public.program_stages FOR SELECT USING (((is_active = true) AND (deleted_at IS NULL)));


--
-- Name: program_certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.program_certificates ENABLE ROW LEVEL SECURITY;

--
-- Name: program_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: program_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.program_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: program_stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.program_stages ENABLE ROW LEVEL SECURITY;

--
-- Name: program_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.program_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

--
-- Name: programs programs public read active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "programs public read active" ON public.programs FOR SELECT USING (((is_active = true) AND (deleted_at IS NULL)));


--
-- Name: question_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.question_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: referral_codes referral_codes_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY referral_codes_admin_all ON public.referral_codes USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))));


--
-- Name: referral_codes referral_codes_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY referral_codes_user_insert ON public.referral_codes FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (is_custom = false)));


--
-- Name: referral_codes referral_codes_user_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY referral_codes_user_read ON public.referral_codes FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: referral_commission_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referral_commission_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: referrals referrals_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY referrals_admin_all ON public.referrals USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))));


--
-- Name: referrals referrals_referrer_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY referrals_referrer_read ON public.referrals FOR SELECT USING ((referrer_id = auth.uid()));


--
-- Name: submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions subscriptions_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subscriptions_admin_all ON public.subscriptions USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))));


--
-- Name: subscriptions subscriptions_user_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subscriptions_user_read ON public.subscriptions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: test_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: test_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: test_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: test_series; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_series ENABLE ROW LEVEL SECURITY;

--
-- Name: tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

--
-- Name: testseries_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.testseries_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_entitlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

--
-- Name: user_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: user_problem_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_problem_status ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: build_enrollments users can insert own build enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can insert own build enrollments" ON public.build_enrollments FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: build_stage_results users can insert own build results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can insert own build results" ON public.build_stage_results FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: build_enrollments users can read own build enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can read own build enrollments" ON public.build_enrollments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: build_stage_results users can read own build results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can read own build results" ON public.build_stage_results FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: build_enrollments users can update own build enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can update own build enrollments" ON public.build_enrollments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: build_stage_results users can update own build results; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can update own build results" ON public.build_stage_results FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: program_certificates users read own program certificates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own program certificates" ON public.program_certificates FOR SELECT USING (((auth.uid() = user_id) OR (status = 'issued'::text)));


--
-- Name: program_enrollments users read own program enrollments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own program enrollments" ON public.program_enrollments FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: program_submissions users read own program submissions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users read own program submissions" ON public.program_submissions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: withdrawals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

--
-- Name: withdrawals withdrawals_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY withdrawals_admin_all ON public.withdrawals USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text])))));


--
-- Name: withdrawals withdrawals_user_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY withdrawals_user_insert ON public.withdrawals FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: withdrawals withdrawals_user_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY withdrawals_user_read ON public.withdrawals FOR SELECT USING ((user_id = auth.uid()));


--
-- PostgreSQL database dump complete
--


