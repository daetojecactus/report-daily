import type { DependencyStatus, HealthStatus } from './system.enums';

export interface SystemHealth {
  status: HealthStatus;
  database: DependencyStatus;
  redis: DependencyStatus;
}
