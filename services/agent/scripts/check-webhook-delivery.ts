import 'dotenv/config';
import { selfcheck as callbackTokenSelfcheck } from '../src/callbackToken';
import { selfcheck as deliverEventSelfcheck } from '../src/deliverEvent';

callbackTokenSelfcheck();
deliverEventSelfcheck();
