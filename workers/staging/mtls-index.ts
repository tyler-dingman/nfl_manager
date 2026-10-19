import application from '../web/index';
import { mtlsGate } from './mtls';
export default mtlsGate(application);
