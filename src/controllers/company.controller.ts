import { Request, Response, NextFunction } from 'express';
import { CompanyService } from '../services/company.service';
import { ApiResponse } from '../utils/apiResponse';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}
  async createCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await this.companyService.createCompany(req.userId!, req.body);
      ApiResponse.created(res, { company }, 'Company created successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await this.companyService.getCompanyById(req.params.companyId);
      ApiResponse.success(res, { company }, 'Company retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await this.companyService.updateCompany(
        req.params.companyId,
        req.userId!,
        req.body
      );
      ApiResponse.success(res, { company }, 'Company updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.companyService.deleteCompany(req.params.companyId, req.userId!);
      ApiResponse.success(res, null, 'Company deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCompanies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;
      const sort = req.query.sort as string;
      const order = req.query.order as 'asc' | 'desc';
      const search = req.query.search as string;
      const industry = req.query.industry as string;

      const result = await this.companyService.getCompanies({ page, limit, sort, order }, search, industry);
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getMyCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await this.companyService.getMyCompany(req.userId!);
      ApiResponse.success(res, { company }, 'Company retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

