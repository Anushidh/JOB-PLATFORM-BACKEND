import CompanyFollow, { ICompanyFollow } from '../models/CompanyFollow';
import Company from '../models/Company';
import { ApiError } from '../utils/apiError';

class CompanyFollowService {
  /** Follows a company */
  async followCompany(employeeId: string, companyId: string): Promise<ICompanyFollow> {
    const company = await Company.findById(companyId);
    if (!company) throw ApiError.notFound('Company not found');

    const existing = await CompanyFollow.findOne({ employee: employeeId, company: companyId });
    if (existing) throw ApiError.conflict('Already following this company');

    return CompanyFollow.create({ employee: employeeId, company: companyId });
  }

  /** Unfollows a company */
  async unfollowCompany(employeeId: string, companyId: string): Promise<void> {
    const result = await CompanyFollow.findOneAndDelete({ employee: employeeId, company: companyId });
    if (!result) throw ApiError.notFound('Not following this company');
  }

  /** Returns companies the employee follows */
  async getFollowedCompanies(employeeId: string): Promise<ICompanyFollow[]> {
    return CompanyFollow.find({ employee: employeeId })
      .populate('company', 'name logoUrl industry location')
      .sort({ createdAt: -1 });
  }

  /** Checks if an employee follows a specific company */
  async isFollowing(employeeId: string, companyId: string): Promise<boolean> {
    const follow = await CompanyFollow.findOne({ employee: employeeId, company: companyId });
    return !!follow;
  }

  /** Returns follower count for a company */
  async getFollowerCount(companyId: string): Promise<number> {
    return CompanyFollow.countDocuments({ company: companyId });
  }
}

export default new CompanyFollowService();
