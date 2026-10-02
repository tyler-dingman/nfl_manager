import { deviceStorage } from './device-storage';
import { createChunkedStorage } from '../../../packages/storage/chunked-storage';
export const largeDeviceStorage = createChunkedStorage(deviceStorage);
