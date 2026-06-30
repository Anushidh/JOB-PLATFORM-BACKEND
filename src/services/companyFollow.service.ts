import { ApiError } from '../utils/apiError';
import { CompanyFollowRepository } from '../repositories/companyFollow.repository';
import { ICompanyFollow } from '../models/CompanyFollow';

export class CompanyFollowService {
  constructor(private readonly companyFollowRepository: CompanyFollowRepository) {}

  async followCompany(employeeId: string, companyId: string): Promise<ICompanyFollow> {
    const company = await this.companyFollowRepository.findCompanyById(companyId);
    if (!company) throw ApiError.notFound('Company not found');

    const existing = await this.companyFollowRepository.findFollow(employeeId, companyId);
    if (existing) throw ApiError.conflict('Already following this company');

    return this.companyFollowRepository.create(employeeId, companyId);
  }

  async unfollowCompany(employeeId: string, companyId: string): Promise<void> {
    const result = await this.companyFollowRepository.deleteFollow(employeeId, companyId);
    if (!result) throw ApiError.notFound('Not following this company');
  }

  async getFollowedCompanies(employeeId: string): Promise<ICompanyFollow[]> {
    return this.companyFollowRepository.findByEmployee(employeeId);
  }

  async isFollowing(employeeId: string, companyId: string): Promise<boolean> {
    const follow = await this.companyFollowRepository.findFollow(employeeId, companyId);
    return !!follow;
  }

  async getFollowerCount(companyId: string): Promise<number> {
    return this.companyFollowRepository.countByCompany(companyId);
  }
}
