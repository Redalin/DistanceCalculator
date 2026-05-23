export type LatLng = [number, number];
export type RouteEntry = { personId: string; distance: number; duration: number };
export type RouteGeometry = [number, number][];
export type CarpoolPickupMode = 'passenger-meets-driver' | 'driver-picks-up';
export type CarpoolLeg = {
  poolId: string;
  hostId: string;
  passengerId: string;
  distance: number;
  duration: number;
  pickupMode: CarpoolPickupMode;
  passengerDriveDistance: number;
  driverDetourDistance: number;
  pickupDistance: number;
};
export type CarpoolPool = { id: string; hostId: string; memberIds: string[] };
