import ProfileView from '../models/ProfileView';
import { UserRole } from '../types';

export class ProfileViewRepository {
  constructor(
    private readonly profileViewModel: typeof ProfileView = ProfileView,
  ) {}

  findTodayView(profileOwnerId: string, viewerId: string, startOfDay: Date) {
    return this.profileViewModel.findOne({
      profileOwner: profileOwnerId,
      viewer: viewerId,
      viewedAt: { $gte: startOfDay },
    });
  }

  create(data: {
    profileOwner: string;
    profileOwnerRole: UserRole;
    viewer: string;
    viewerRole: UserRole;
    viewedAt: Date;
  }) {
    return this.profileViewModel.create(data);
  }

  findByProfileOwner(profileOwnerId: string, skip: number, limit: number) {
    return this.profileViewModel.find({ profileOwner: profileOwnerId })
      .sort({ viewedAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  countByProfileOwner(profileOwnerId: string) {
    return this.profileViewModel.countDocuments({ profileOwner: profileOwnerId });
  }

  countRecentViews(profileOwnerId: string, since: Date) {
    return this.profileViewModel.countDocuments({
      profileOwner: profileOwnerId,
      viewedAt: { $gte: since },
    });
  }
}
