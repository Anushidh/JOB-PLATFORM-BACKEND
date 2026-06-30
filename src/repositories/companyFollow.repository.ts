import CompanyFollow, { ICompanyFollow } from '../models/CompanyFollow';
import Company from '../models/Company';

export class CompanyFollowRepository {
  constructor(
    private readonly companyFollowModel: typeof CompanyFollow = CompanyFollow,
    private readonly companyModel: typeof Company = Company,
  ) {}

  findCompanyById(companyId: string) {
    return this.companyModel.findById(companyId);
  }

  findFollow(employeeId: string, companyId: string) {
    return this.companyFollowModel.findOne({ employee: employeeId, company: companyId });
  }

  create(employeeId: string, companyId: string) {
    return this.companyFollowModel.create({ employee: employeeId, company: companyId });
  }

  deleteFollow(employeeId: string, companyId: string) {
    return this.companyFollowModel.findOneAndDelete({ employee: employeeId, company: companyId });
  }

  findByEmployee(employeeId: string): Promise<ICompanyFollow[]> {
    return this.companyFollowModel.find({ employee: employeeId })
      .populate('company', 'name logoUrl industry location')
      .sort({ createdAt: -1 });
  }

  countByCompany(companyId: string) {
    return this.companyFollowModel.countDocuments({ company: companyId });
  }
}
