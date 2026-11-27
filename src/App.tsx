import { IonApp, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import React from 'react';

import { AppRoutes } from './app/AppRoutes';
import { LaunchSplash } from './components/common/LaunchSplash';
import {
  qocActionSheetEnterAnimation,
  qocActionSheetLeaveAnimation,
  qocAlertEnterAnimation,
  qocAlertLeaveAnimation,
  qocModalEnterAnimation,
  qocModalLeaveAnimation,
  qocNavAnimation,
} from './utils/animations';

/* All Ionic CSS + Tailwind CSS v4 + QOC Design System Tokens are imported in proper @layer order here */
import './theme/variables.css';

setupIonicReact({
  mode: 'md',
  modalEnter: qocModalEnterAnimation,
  modalLeave: qocModalLeaveAnimation,
  actionSheetEnter: qocActionSheetEnterAnimation,
  actionSheetLeave: qocActionSheetLeaveAnimation,
  alertEnter: qocAlertEnterAnimation,
  alertLeave: qocAlertLeaveAnimation,
  navAnimation: qocNavAnimation,
});

const App: React.FC = () => (
  <IonApp>
    <LaunchSplash />
    <IonReactRouter>
      <AppRoutes />
    </IonReactRouter>
  </IonApp>
);

export default App;
