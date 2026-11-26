import { IonApp, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import React from 'react';

import { AppRoutes } from './app/AppRoutes';
import { LaunchSplash } from './components/common/LaunchSplash';

/* All Ionic CSS + Tailwind CSS v4 + QOC Design System Tokens are imported in proper @layer order here */
import './theme/variables.css';

setupIonicReact({
  mode: 'md',
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
