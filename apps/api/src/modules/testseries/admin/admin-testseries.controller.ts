import { Request, Response } from 'express';
import logger from '../../../config/logger';
import {
  AdminExamCategoriesService,
  AdminTestSeriesCatalogService,
  AdminTestsService,
  AdminQuestionBankService,
} from './admin-testseries.service';

function handleError(res: Response, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  logger.error(fallback, error);
  if (message.endsWith('not found') || message.includes('does not match')) {
    return res.status(404).json({ error: message });
  }
  return res.status(400).json({ error: message });
}

export class AdminExamCategoriesController {
  static async list(_req: Request, res: Response) {
    try {
      res.json(await AdminExamCategoriesService.list());
    } catch (error) {
      handleError(res, error, 'Failed to list exam categories');
    }
  }

  static async create(req: Request, res: Response) {
    try {
      res.status(201).json(await AdminExamCategoriesService.create(req.body));
    } catch (error) {
      handleError(res, error, 'Failed to create exam category');
    }
  }

  static async update(req: Request, res: Response) {
    try {
      res.json(await AdminExamCategoriesService.update(req.params.id as string, req.body));
    } catch (error) {
      handleError(res, error, 'Failed to update exam category');
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      await AdminExamCategoriesService.remove(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      handleError(res, error, 'Failed to delete exam category');
    }
  }
}

export class AdminTestSeriesController {
  static async list(req: Request, res: Response) {
    try {
      res.json(await AdminTestSeriesCatalogService.list(req.query.exam_category_id as string | undefined));
    } catch (error) {
      handleError(res, error, 'Failed to list test series');
    }
  }

  static async get(req: Request, res: Response) {
    try {
      res.json(await AdminTestSeriesCatalogService.get(req.params.id as string));
    } catch (error) {
      handleError(res, error, 'Failed to fetch test series');
    }
  }

  static async create(req: Request, res: Response) {
    try {
      res.status(201).json(await AdminTestSeriesCatalogService.create(req.body));
    } catch (error) {
      handleError(res, error, 'Failed to create test series');
    }
  }

  static async update(req: Request, res: Response) {
    try {
      res.json(await AdminTestSeriesCatalogService.update(req.params.id as string, req.body));
    } catch (error) {
      handleError(res, error, 'Failed to update test series');
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      await AdminTestSeriesCatalogService.remove(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      handleError(res, error, 'Failed to delete test series');
    }
  }
}

export class AdminTestsController {
  static async list(req: Request, res: Response) {
    try {
      res.json(await AdminTestsService.list(req.query.test_series_id as string | undefined));
    } catch (error) {
      handleError(res, error, 'Failed to list tests');
    }
  }

  static async get(req: Request, res: Response) {
    try {
      res.json(await AdminTestsService.get(req.params.id as string));
    } catch (error) {
      handleError(res, error, 'Failed to fetch test');
    }
  }

  static async create(req: Request, res: Response) {
    try {
      res.status(201).json(await AdminTestsService.create(req.body));
    } catch (error) {
      handleError(res, error, 'Failed to create test');
    }
  }

  static async update(req: Request, res: Response) {
    try {
      res.json(await AdminTestsService.update(req.params.id as string, req.body));
    } catch (error) {
      handleError(res, error, 'Failed to update test');
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      await AdminTestsService.remove(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      handleError(res, error, 'Failed to delete test');
    }
  }

  static async addSection(req: Request, res: Response) {
    try {
      res.status(201).json(await AdminTestsService.addSection(req.params.id as string, req.body));
    } catch (error) {
      handleError(res, error, 'Failed to create section');
    }
  }

  static async updateSection(req: Request, res: Response) {
    try {
      res.json(await AdminTestsService.updateSection(req.params.sectionId as string, req.body));
    } catch (error) {
      handleError(res, error, 'Failed to update section');
    }
  }

  static async removeSection(req: Request, res: Response) {
    try {
      await AdminTestsService.removeSection(req.params.sectionId as string);
      res.status(204).send();
    } catch (error) {
      handleError(res, error, 'Failed to delete section');
    }
  }

  static async attachQuestion(req: Request, res: Response) {
    try {
      res.status(201).json(await AdminTestsService.attachQuestion(req.params.id as string, req.body));
    } catch (error) {
      handleError(res, error, 'Failed to attach question');
    }
  }

  static async detachQuestion(req: Request, res: Response) {
    try {
      await AdminTestsService.detachQuestion(req.params.id as string, req.params.questionId as string);
      res.status(204).send();
    } catch (error) {
      handleError(res, error, 'Failed to detach question');
    }
  }

  static async reorderQuestions(req: Request, res: Response) {
    try {
      const { orderedQuestionIds } = req.body as { orderedQuestionIds: string[] };
      await AdminTestsService.reorderQuestions(req.params.id as string, orderedQuestionIds);
      res.status(204).send();
    } catch (error) {
      handleError(res, error, 'Failed to reorder questions');
    }
  }
}

export class AdminQuestionBankController {
  static async list(req: Request, res: Response) {
    try {
      res.json(
        await AdminQuestionBankService.list({
          search: req.query.search as string | undefined,
          topic: req.query.topic as string | undefined,
          difficulty: req.query.difficulty as string | undefined,
          questionType: req.query.question_type as string | undefined,
          page: req.query.page ? Number(req.query.page) : undefined,
          limit: req.query.limit ? Number(req.query.limit) : undefined,
        })
      );
    } catch (error) {
      handleError(res, error, 'Failed to list question bank');
    }
  }

  static async listTopics(_req: Request, res: Response) {
    try {
      res.json(await AdminQuestionBankService.listTopics());
    } catch (error) {
      handleError(res, error, 'Failed to list topics');
    }
  }

  static async get(req: Request, res: Response) {
    try {
      res.json(await AdminQuestionBankService.get(req.params.id as string));
    } catch (error) {
      handleError(res, error, 'Failed to fetch question');
    }
  }

  static async create(req: Request, res: Response) {
    try {
      res.status(201).json(await AdminQuestionBankService.create(req.body));
    } catch (error) {
      handleError(res, error, 'Failed to create question');
    }
  }

  static async update(req: Request, res: Response) {
    try {
      res.json(await AdminQuestionBankService.update(req.params.id as string, req.body));
    } catch (error) {
      handleError(res, error, 'Failed to update question');
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      await AdminQuestionBankService.remove(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      handleError(res, error, 'Failed to delete question');
    }
  }
}
