import { ApiError } from '../utils/apiError';
import { CompanyRepository } from '../repositories/company.repository';
import { ICompany, PaginationOptions, PaginatedResult } from '../types';

export class CompanyService {
  constructor(private readonly companyRepository: CompanyRepository) {}

  async createCompany(ownerId: string, companyData: Partial<ICompany>): Promise<ICompany> {
    const existingCompany = await this.companyRepository.findByOwner(ownerId);
    if (existingCompany) {
      throw ApiError.conflict('You already have a company registered');
    }

    const company = await this.companyRepository.create({
      ...companyData,
      owner: ownerId,
    } as Partial<ICompany> & { owner: string });

    await this.companyRepository.linkToEmployer(ownerId, company._id.toString());

    return company;
  }

  async getCompanyById(companyId: string): Promise<ICompany> {
    const company = await this.companyRepository.findByIdWithOwner(companyId);
    if (!company) {
      throw ApiError.notFound('Company not found');
    }
    return company;
  }

  async updateCompany(companyId: string, ownerId: string, updateData: Partial<ICompany>): Promise<ICompany> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw ApiError.notFound('Company not found');
    }

    if (company.owner.toString() !== ownerId) {
      throw ApiError.forbidden('You can only update your own company');
    }

    delete (updateData as Record<string, unknown>).owner;

    const updatedCompany = await this.companyRepository.update(companyId, updateData);

    return updatedCompany!;
  }

  async deleteCompany(companyId: string, ownerId: string): Promise<void> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw ApiError.notFound('Company not found');
    }

    if (company.owner.toString() !== ownerId) {
      throw ApiError.forbidden('You can only delete your own company');
    }

    await this.companyRepository.delete(companyId);
    await this.companyRepository.unlinkFromEmployer(ownerId);
  }

  async getCompanies(
    options: PaginationOptions,
    search?: string,
    industry?: string,
  ): Promise<PaginatedResult<ICompany>> {
    return this.companyRepository.findAll(options, search, industry);
  }

  async getMyCompany(ownerId: string): Promise<ICompany | null> {
    return this.companyRepository.findByOwner(ownerId);
  }
}
