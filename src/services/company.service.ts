import Company from '../models/Company';
import Employer from '../models/Employer';
import { ApiError } from '../utils/apiError';
import { ICompany, PaginationOptions, PaginatedResult } from '../types';

class CompanyService {
  /** Creates a company for an employer and links it to their profile */
  async createCompany(ownerId: string, companyData: Partial<ICompany>): Promise<ICompany> {
    // Check if employer already has a company
    const existingCompany = await Company.findOne({ owner: ownerId });
    if (existingCompany) {
      throw ApiError.conflict('You already have a company registered');
    }

    const company = await Company.create({
      ...companyData,
      owner: ownerId,
    });

    // Link company to employer
    await Employer.findByIdAndUpdate(ownerId, { company: company._id });

    return company;
  }

  /** Fetches a company by ID with populated owner details */
  async getCompanyById(companyId: string): Promise<ICompany> {
    const company = await Company.findById(companyId).populate({
      path: 'owner',
      select: 'firstName lastName email',
      model: 'Employer',
    });
    if (!company) {
      throw ApiError.notFound('Company not found');
    }
    return company;
  }

  /** Updates company details after verifying ownership; prevents changing owner */
  async updateCompany(companyId: string, ownerId: string, updateData: Partial<ICompany>): Promise<ICompany> {
    const company = await Company.findById(companyId);
    if (!company) {
      throw ApiError.notFound('Company not found');
    }

    if (company.owner.toString() !== ownerId) {
      throw ApiError.forbidden('You can only update your own company');
    }

    // Prevent changing owner
    delete (updateData as any).owner;

    const updatedCompany = await Company.findByIdAndUpdate(
      companyId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate({
      path: 'owner',
      select: 'firstName lastName email',
      model: 'Employer',
    });

    return updatedCompany!;
  }

  /** Permanently deletes a company and unlinks it from the employer profile */
  async deleteCompany(companyId: string, ownerId: string): Promise<void> {
    const company = await Company.findById(companyId);
    if (!company) {
      throw ApiError.notFound('Company not found');
    }

    if (company.owner.toString() !== ownerId) {
      throw ApiError.forbidden('You can only delete your own company');
    }

    await Company.findByIdAndDelete(companyId);
    await Employer.findByIdAndUpdate(ownerId, { company: null });
  }

  /** Returns paginated companies, optionally filtered by name/description search and industry */
  async getCompanies(
    options: PaginationOptions,
    search?: string,
    industry?: string
  ): Promise<PaginatedResult<ICompany>> {
    const { page, limit, sort = 'createdAt', order = 'desc' } = options;
    const skip = (page - 1) * limit;

    const query: any = {};

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
      Company.find(query)
        .populate({
          path: 'owner',
          select: 'firstName lastName',
          model: 'Employer',
        })
        .sort({ [sort]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Company.countDocuments(query),
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

  /** Returns the company owned by the given employer, or null if none exists */
  async getMyCompany(ownerId: string): Promise<ICompany | null> {
    return Company.findOne({ owner: ownerId });
  }
}

export default new CompanyService();
