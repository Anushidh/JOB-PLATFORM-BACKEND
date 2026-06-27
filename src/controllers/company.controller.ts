import { Request, Response, NextFunction } from 'express';
import companyService from '../services/company.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthRequest } from '../types';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

class CompanyController {
  async createCompany(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await companyService.createCompany(req.userId!, req.body);
      ApiResponse.created(res, { company }, 'Company created successfully');
    } catch (error) {
      next(error);
    }
  }

  async getCompany(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await companyService.getCompanyById(req.params.companyId);
      ApiResponse.success(res, { company }, 'Company retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateCompany(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await companyService.updateCompany(
        req.params.companyId,
        req.userId!,
        req.body
      );
      ApiResponse.success(res, { company }, 'Company updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async deleteCompany(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await companyService.deleteCompany(req.params.companyId, req.userId!);
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

      const result = await companyService.getCompanies({ page, limit, sort, order }, search, industry);
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getMyCompany(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await companyService.getMyCompany(req.userId!);
      ApiResponse.success(res, { company }, 'Company retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

export default new CompanyController();
