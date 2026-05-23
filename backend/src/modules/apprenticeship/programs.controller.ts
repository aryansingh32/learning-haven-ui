import { Request, Response } from 'express';
import { ProgramsService } from './programs.service';
import { ProjectsService } from './projects.service';
import { SubmissionsService } from './submissions.service';
import { GitHubService } from '../github/github.service';
import { supabase } from '../../config/database';
import logger from '../../config/logger';
import { AuthRequest } from '../../middleware/auth';
import { fail, ok } from './http';
import { ApprenticeshipAdminService } from './admin.service';

const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value || '');

export class ApprenticeshipController {
  static async listPrograms(req: Request, res: Response) {
    try {
      const programs = await ProgramsService.listActivePrograms({
        difficulty: req.query.difficulty as string,
        tech_stack: req.query.tech_stack as string,
      });

      res.json(ok({ programs, total: programs.length }));
    } catch (error) {
      logger.error('Error in listPrograms:', error);
      res.status(500).json(fail('Failed to fetch programs', 'E_APPR_500'));
    }
  }

  static async getProgramBySlug(req: Request, res: Response) {
    try {
      const program = await ProgramsService.getProgramBySlug(param(req.params.slug));

      if (!program) {
        return res.status(404).json(fail('Program not found', 'E_APPR_404'));
      }

      res.json(ok({ program }));
    } catch (error) {
      logger.error('Error in getProgramBySlug:', error);
      res.status(500).json(fail('Failed to fetch program', 'E_APPR_501'));
    }
  }

  static async getLeaderboard(req: Request, res: Response) {
    try {
      const leaderboard = await ProgramsService.getLeaderboard(
        param(req.params.programId),
        (req.query.type as string) || 'fastest'
      );

      res.json(ok({ leaderboard, type: (req.query.type as string) || 'fastest' }));
    } catch (error) {
      logger.error('Error in getLeaderboard:', error);
      res.status(500).json(fail('Failed to fetch leaderboard', 'E_APPR_502'));
    }
  }

  static async verifyCertificate(req: Request, res: Response) {
    try {
      const certificate = await ProgramsService.verifyCertificate(param(req.params.code));

      if (!certificate) {
        return res.status(404).json(fail('Certificate not found', 'E_CERT_404'));
      }

      res.json(ok({ valid: true, certificate }));
    } catch (error) {
      logger.error('Error in verifyCertificate:', error);
      res.status(500).json(fail('Failed to verify certificate', 'E_CERT_500'));
    }
  }

  static async getMyEnrollments(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user?.id;
      const { data, error } = await supabase
        .from('apprenticeship_enrollments')
        .select(`
          *,
          apprenticeship_programs (*)
        `)
        .eq('user_id', userId)
        .order('enrolled_at', { ascending: false });

      if (error) {
        throw error;
      }

      res.json(ok({ enrollments: data || [] }));
    } catch (error) {
      logger.error('Error in getMyEnrollments:', error);
      res.status(500).json(fail('Failed to fetch enrollments', 'E_ENROLL_500'));
    }
  }

  static async getEnrollmentDetail(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user?.id;
      const { data, error } = await supabase
        .from('apprenticeship_enrollments')
        .select(`
          *,
          apprenticeship_programs (*),
          apprenticeship_project_progress (
            *,
            apprenticeship_projects (*)
          )
        `)
        .eq('id', param(req.params.enrollmentId))
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return res.status(404).json(fail('Enrollment not found', 'E_ENROLL_404'));
      }

      res.json(ok({ enrollment: data }));
    } catch (error) {
      logger.error('Error in getEnrollmentDetail:', error);
      res.status(500).json(fail('Failed to fetch enrollment', 'E_ENROLL_501'));
    }
  }

  static async getProjectWorkspace(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user?.id;
      const workspace = await ProjectsService.getProjectWorkspace(param(req.params.projectId), userId);

      if (!workspace?.project) {
        return res.status(404).json(fail('Project not found', 'E_PROJ_404'));
      }

      if (!workspace.progress || workspace.progress.status === 'locked') {
        return res.status(403).json(fail('Project is locked', 'E_PROJ_403'));
      }

      res.json(ok({ workspace }));
    } catch (error) {
      logger.error('Error in getProjectWorkspace:', error);
      res.status(500).json(fail('Failed to fetch project workspace', 'E_PROJ_500'));
    }
  }

  static async startProject(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user?.id;
      const workspace = await ProjectsService.getProjectWorkspace(param(req.params.projectId), userId);

      if (!workspace?.project) {
        return res.status(404).json(fail('Project not found', 'E_PROJ_404'));
      }

      if (!workspace.progress) {
        return res.status(403).json(fail('Enrollment required before starting a project', 'E_PROJ_401'));
      }

      if (!workspace.project.starter_repo_url) {
        return res.status(400).json(fail('Starter repository is not configured for this project', 'E_PROJ_400'));
      }

      const repo = await GitHubService.provisionRepository(
        userId,
        workspace.progress.apprenticeship_enrollments.program_id,
        workspace.project.slug,
        workspace.project.starter_repo_url
      );

      const projectProgress = await ProjectsService.startProject(param(req.params.projectId), userId, {
        github_repo_full_name: repo.repo_name,
        github_repo_url: repo.html_url,
        webhook_secret: repo.webhook_secret,
      });

      res.json(ok({
        project_progress: projectProgress,
        repository: repo,
        clone_command: `git clone ${repo.clone_url}`,
      }));
    } catch (error: any) {
      logger.error('Error in startProject:', error);
      res.status(500).json(fail(error.message || 'Failed to start project', 'E_PROJ_501'));
    }
  }

  static async disconnectGitHub(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user?.id;
      const { error } = await supabase
        .from('apprenticeship_github_connections')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      res.json(ok({ message: 'GitHub disconnected successfully' }));
    } catch (error) {
      logger.error('Error in disconnectGitHub:', error);
      res.status(500).json(fail('Failed to disconnect GitHub', 'E_GH_500'));
    }
  }

  static async adminListPrograms(req: Request, res: Response) {
    try {
      const programs = await ProgramsService.listAllPrograms();
      res.json(ok({ programs, total: programs.length }));
    } catch (error) {
      logger.error('Error in adminListPrograms:', error);
      res.status(500).json(fail('Failed to fetch programs', 'E_ADMIN_PROG_500'));
    }
  }

  static async adminGetProgram(req: Request, res: Response) {
    try {
      const program = await ProgramsService.getProgramById(param(req.params.id));

      if (!program) {
        return res.status(404).json(fail('Program not found', 'E_ADMIN_PROG_404'));
      }

      res.json(ok({ program }));
    } catch (error) {
      logger.error('Error in adminGetProgram:', error);
      res.status(500).json(fail('Failed to fetch program', 'E_ADMIN_PROG_501'));
    }
  }

  static async adminCreateProgram(req: Request, res: Response) {
    try {
      const {
        title,
        slug,
        description,
        duration_days,
        price_inr,
        original_price_inr,
        tech_stack,
        difficulty_level,
        total_projects,
        learning_paths,
        max_enrollments,
        status,
        certificate_preview_url,
      } = req.body;

      if (!title || !slug || !duration_days || price_inr === undefined || !difficulty_level) {
        return res.status(400).json(fail(
          'Missing required fields: title, slug, duration_days, price_inr, difficulty_level',
          'E_ADMIN_PROG_400'
        ));
      }

      const program = await ProgramsService.createProgram({
        title,
        slug,
        description,
        duration_days,
        price_inr,
        original_price_inr,
        tech_stack,
        difficulty_level,
        total_projects,
        learning_paths,
        max_enrollments,
        status,
        certificate_preview_url,
      });

      res.status(201).json(ok({ program }));
    } catch (error: any) {
      logger.error('Error in adminCreateProgram:', error);
      if (error.message?.includes('slug already exists')) {
        return res.status(409).json(fail(error.message, 'E_ADMIN_PROG_409'));
      }
      res.status(500).json(fail('Failed to create program', 'E_ADMIN_PROG_502'));
    }
  }

  static async adminUpdateProgram(req: Request, res: Response) {
    try {
      const program = await ProgramsService.updateProgram(param(req.params.id), req.body);
      res.json(ok({ program }));
    } catch (error: any) {
      logger.error('Error in adminUpdateProgram:', error);
      if (error.message?.includes('slug already exists')) {
        return res.status(409).json(fail(error.message, 'E_ADMIN_PROG_409'));
      }
      res.status(500).json(fail('Failed to update program', 'E_ADMIN_PROG_503'));
    }
  }

  static async adminArchiveProgram(req: Request, res: Response) {
    try {
      await ProgramsService.archiveProgram(param(req.params.id));
      res.json(ok({ message: 'Program archived successfully' }));
    } catch (error) {
      logger.error('Error in adminArchiveProgram:', error);
      res.status(500).json(fail('Failed to archive program', 'E_ADMIN_PROG_504'));
    }
  }

  static async adminReorderProjects(req: Request, res: Response) {
    try {
      const { order } = req.body;

      if (!Array.isArray(order) || order.length === 0) {
        return res.status(400).json(fail('order array is required', 'E_ADMIN_PROJ_400'));
      }

      await ProgramsService.reorderProjects(param(req.params.id), order);
      res.json(ok({ message: 'Projects reordered successfully' }));
    } catch (error) {
      logger.error('Error in adminReorderProjects:', error);
      res.status(500).json(fail('Failed to reorder projects', 'E_ADMIN_PROJ_500'));
    }
  }

  static async adminListProjects(req: Request, res: Response) {
    try {
      const projects = await ProjectsService.getProjectsByProgram(param(req.params.programId));
      res.json(ok({ projects }));
    } catch (error) {
      logger.error('Error in adminListProjects:', error);
      res.status(500).json(fail('Failed to fetch projects', 'E_ADMIN_PROJ_501'));
    }
  }

  static async adminCreateProject(req: Request, res: Response) {
    try {
      const {
        project_number,
        title,
        slug,
        description,
        estimated_hours,
        traditional_guide,
        ai_guide,
        starter_repo_url,
        reference_solution_url,
        helpful_resources,
        verification_mode,
        verification_requirements,
        docker_test_image,
        sort_order,
      } = req.body;

      if (!project_number || !title || !slug) {
        return res.status(400).json(fail('Missing required fields: project_number, title, slug', 'E_ADMIN_PROJ_400'));
      }

      const project = await ProjectsService.createProject(param(req.params.programId), {
        project_number,
        title,
        slug,
        description,
        estimated_hours,
        traditional_guide,
        ai_guide,
        starter_repo_url,
        reference_solution_url,
        helpful_resources,
        verification_mode,
        verification_requirements,
        docker_test_image,
        sort_order,
      });

      res.status(201).json(ok({ project }));
    } catch (error: any) {
      logger.error('Error in adminCreateProject:', error);
      if (error.message?.includes('number already exists')) {
        return res.status(409).json(fail(error.message, 'E_ADMIN_PROJ_409'));
      }
      res.status(500).json(fail('Failed to create project', 'E_ADMIN_PROJ_502'));
    }
  }

  static async adminGetProject(req: Request, res: Response) {
    try {
      const project = await ProjectsService.getProjectById(param(req.params.id));

      if (!project) {
        return res.status(404).json(fail('Project not found', 'E_ADMIN_PROJ_404'));
      }

      res.json(ok({ project }));
    } catch (error) {
      logger.error('Error in adminGetProject:', error);
      res.status(500).json(fail('Failed to fetch project', 'E_ADMIN_PROJ_503'));
    }
  }

  static async adminUpdateProject(req: Request, res: Response) {
    try {
      const project = await ProjectsService.updateProject(param(req.params.id), req.body);
      res.json(ok({ project }));
    } catch (error) {
      logger.error('Error in adminUpdateProject:', error);
      res.status(500).json(fail('Failed to update project', 'E_ADMIN_PROJ_504'));
    }
  }

  static async adminDeleteProject(req: Request, res: Response) {
    try {
      await ProjectsService.deleteProject(param(req.params.id));
      res.json(ok({ message: 'Project deleted successfully' }));
    } catch (error) {
      logger.error('Error in adminDeleteProject:', error);
      res.status(500).json(fail('Failed to delete project', 'E_ADMIN_PROJ_505'));
    }
  }

  static async adminListSubmissions(req: Request, res: Response) {
    try {
      const submissions = await SubmissionsService.adminListSubmissions({
        status: req.query.status as string | undefined,
        projectId: req.query.projectId as string | undefined,
        userId: req.query.userId as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      });

      res.json(ok({ submissions }));
    } catch (error) {
      logger.error('Error in adminListSubmissions:', error);
      res.status(500).json(fail('Failed to fetch submissions', 'E_ADMIN_SUB_500'));
    }
  }

  static async adminReviewSubmission(req: Request, res: Response) {
    try {
      const reviewerId = (req as AuthRequest).user?.id;
      const submission = await SubmissionsService.adminReviewSubmission(param(req.params.id), reviewerId, {
        status: req.body.status,
        reviewer_notes: req.body.reviewer_notes,
        code_quality_override: req.body.code_quality_override,
        xp_bonus: req.body.xp_bonus,
      });

      res.json(ok({ submission }));
    } catch (error) {
      logger.error('Error in adminReviewSubmission:', error);
      res.status(500).json(fail('Failed to review submission', 'E_ADMIN_SUB_501'));
    }
  }

  static async adminOverview(req: Request, res: Response) {
    try {
      const overview = await ApprenticeshipAdminService.getOverview();
      res.json(ok({ overview }));
    } catch (error) {
      logger.error('Error in adminOverview:', error);
      res.status(500).json(fail('Failed to fetch overview', 'E_ADMIN_OVERVIEW_500'));
    }
  }

  static async adminStudents(req: Request, res: Response) {
    try {
      const students = await ApprenticeshipAdminService.getStudents(
        req.query.search as string | undefined,
        req.query.programId as string | undefined,
        req.query.status as string | undefined
      );
      res.json(ok({ students }));
    } catch (error) {
      logger.error('Error in adminStudents:', error);
      res.status(500).json(fail('Failed to fetch students', 'E_ADMIN_STUDENTS_500'));
    }
  }

  static async adminStudentDetail(req: Request, res: Response) {
    try {
      const detail = await ApprenticeshipAdminService.getStudentDetail(param(req.params.userId));
      res.json(ok({ detail }));
    } catch (error) {
      logger.error('Error in adminStudentDetail:', error);
      res.status(500).json(fail('Failed to fetch student detail', 'E_ADMIN_STUDENT_500'));
    }
  }

  static async adminAnalytics(req: Request, res: Response) {
    try {
      const analytics = await ApprenticeshipAdminService.getAnalytics(req.query.programId as string | undefined);
      res.json(ok({ analytics }));
    } catch (error) {
      logger.error('Error in adminAnalytics:', error);
      res.status(500).json(fail('Failed to fetch analytics', 'E_ADMIN_ANALYTICS_500'));
    }
  }

  static async adminCoupons(req: Request, res: Response) {
    try {
      const coupons = await ApprenticeshipAdminService.listCoupons();
      res.json(ok({ coupons }));
    } catch (error) {
      logger.error('Error in adminCoupons:', error);
      res.status(500).json(fail('Failed to fetch coupons', 'E_ADMIN_COUPONS_500'));
    }
  }

  static async adminCreateCoupon(req: Request, res: Response) {
    try {
      const coupon = await ApprenticeshipAdminService.createCoupon(req.body);
      res.status(201).json(ok({ coupon }));
    } catch (error) {
      logger.error('Error in adminCreateCoupon:', error);
      res.status(500).json(fail('Failed to create coupon', 'E_ADMIN_COUPONS_501'));
    }
  }

  static async adminUpdateCoupon(req: Request, res: Response) {
    try {
      const coupon = await ApprenticeshipAdminService.updateCoupon(param(req.params.id), req.body);
      res.json(ok({ coupon }));
    } catch (error) {
      logger.error('Error in adminUpdateCoupon:', error);
      res.status(500).json(fail('Failed to update coupon', 'E_ADMIN_COUPONS_502'));
    }
  }

  static async adminDeleteCoupon(req: Request, res: Response) {
    try {
      await ApprenticeshipAdminService.deactivateCoupon(param(req.params.id));
      res.json(ok({ message: 'Coupon deactivated' }));
    } catch (error) {
      logger.error('Error in adminDeleteCoupon:', error);
      res.status(500).json(fail('Failed to deactivate coupon', 'E_ADMIN_COUPONS_503'));
    }
  }

  static async adminBroadcastNotification(req: Request, res: Response) {
    try {
      const result = await ApprenticeshipAdminService.broadcastNotification(req.body);
      res.json(ok({ result }));
    } catch (error) {
      logger.error('Error in adminBroadcastNotification:', error);
      res.status(500).json(fail('Failed to send notification', 'E_ADMIN_NOTIFY_500'));
    }
  }
}
