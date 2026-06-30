import Company from '../models/Company';
import Employer from '../models/Employer';
import { ICompany, PaginationOptions, PaginatedResult } from '../types';

export class CompanyRepository {
  constructor(
    private readonly companyModel: typeof Company = Company,
    private readonly employerModel: typeof Employer = Employer,
  ) {}

  findByOwner(ownerId: string) {
    return this.companyModel.findOne({ owner: ownerId });
  }

  create(data: Partial<ICompany> & { owner: string }) {
    return this.companyModel.create(data);
  }

  linkToEmployer(ownerId: string, companyId: string) {
    return this.employerModel.findByIdAndUpdate(ownerId, { company: companyId });
  }

  findById(companyId: string) {
    return this.companyModel.findById(companyId);
  }

  findByIdWithOwner(companyId: string) {
    return this.companyModel.findById(companyId).populate({
      path: 'owner',
      select: 'firstName lastName email',
    });
  }

  update(companyId: string, updateData: Partial<ICompany>) {
    return this.companyModel.findByIdAndUpdate(
      companyId,
      { $set: updateData },
      { new: true, runValidators: true },
    ).populate({
      path: 'owner',
      select: 'firstName lastName email',
    });
  }

  delete(companyId: string) {
    return this.companyModel.findByIdAndDelete(companyId);
  }

  unlinkFromEmployer(ownerId: string) {
    return this.employerModel.findByIdAndUpdate(ownerId, { company: null });
  }

  async findAll(
    options: PaginationOptions,
    search?: string,
    industry?: string,
  ): Promise<PaginatedResult<ICompany>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (industry) {
      query.industry = industry;
    }

    const [companies, total] = await Promise.all([
      this.companyModel.find(query)
        .populate({
          path: 'owner',
          select: 'firstName lastName',
        })
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      this.companyModel.countDocuments(query),
    ]);

    return {
      data: companies,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  countDocuments() {
    return this.companyModel.countDocuments();
  }
}
