import application from '../web/index';
import { stagingAccessGate } from './credential-access';
import { authorizedStagingDispatch } from './authorized-dispatch';
export default stagingAccessGate(authorizedStagingDispatch(application));
