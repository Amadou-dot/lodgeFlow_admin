export interface CabinStats {
  totalCabins: number;
  totalCapacity: number;
  averagePrice: number | null;
  cabinsWithDiscount: number;
  activeCabins: number;
  inactiveCabins: number;
  maintenanceCabins: number;
}

export interface DiningStats {
  totalItems: number;
  menuCount: number;
  experienceCount: number;
  averagePrice: number | null;
  availableItems: number;
}

export interface ExperienceStats {
  totalExperiences: number;
  averagePrice: number | null;
  popularCount: number;
  totalCapacity: number;
}

export interface BookingStats {
  todayCheckIns: number;
  todayCheckOuts: number;
  checkedIn: number;
  unconfirmed: number;
}
