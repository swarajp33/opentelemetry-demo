// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0

import '../styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App, { AppContext, AppProps } from 'next/app';
import CurrencyProvider from '../providers/Currency.provider';
import CartProvider from '../providers/Cart.provider';
import { ThemeProvider } from 'styled-components';
import Theme from '../styles/Theme';
import FrontendTracer from '../utils/telemetry/FrontendTracer';
import SessionGateway from '../gateways/Session.gateway';
import { OpenFeatureProvider, OpenFeature } from '@openfeature/react-sdk';
import { FlagdWebProvider } from '@openfeature/flagd-web-provider';

declare global {
  interface Window {
    __eosStarted?: boolean;
    ENV: {
      NEXT_PUBLIC_PLATFORM?: string;
      NEXT_PUBLIC_OTEL_SERVICE_NAME?: string;
      NEXT_PUBLIC_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
      IS_SYNTHETIC_REQUEST?: string;
    };
  }
}

const startEosSdk = () => {
  if (window.__eosStarted) {
    return;
  }

  window.__eosStarted = true;

  void import('@viklele/eos-sdk')
    .then(({ default: EOS }) => {
      const eos = new EOS({
        apiUrl: 'http://127.0.0.1:8000/',
        authScheme: 'f3ec2a85c4c0167c7c930e2c8c267a6a46adc2d5427d26a0ae062f03aa863913',
        otelEndpoint: 'http://localhost:4318',
        orgName: 'Viklele Consulting LLP',
        appName: 'opentelemetry-demo',
        userName: '06996bcf-174e-7b2e-8000-3faf69827bac',
        clientUserName: 'operator-01',
        facilityName: 'main-godown',
        terminalName: 'desktop-01',
        region: 'india',
        maskingEnabled: false,
      });

      return eos.start();
    })
    .then(() => {
      console.log('EOS started for opentelemetry-demo App');
    })
    .catch((error: unknown) => {
      window.__eosStarted = false;
      console.error('Failed to start EOS SDK', error);
    });
};

if (typeof window !== 'undefined') {
  startEosSdk();

  FrontendTracer();
  if (window.location) {
    const session = SessionGateway.getSession();

    // Set context prior to provider init to avoid multiple http calls
    OpenFeature.setContext({ targetingKey: session.userId, ...session }).then(() => {
      /**
       * We connect to flagd through the envoy proxy, straight from the browser,
       * for this we need to know the current hostname and port.
       */

      const useTLS = window.location.protocol === 'https:';
      let port = useTLS ? 443 : 80;
      if (window.location.port) {
          port = parseInt(window.location.port, 10);
      }

      OpenFeature.setProvider(
        new FlagdWebProvider({
          host: window.location.hostname,
          pathPrefix: 'flagservice',
          port: port,
          tls: useTLS,
          maxRetries: 3,
          maxDelay: 10000,
        })
      );
    });
  }
}

const queryClient = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={Theme}>
      <OpenFeatureProvider>
        <QueryClientProvider client={queryClient}>
          <CurrencyProvider>
            <CartProvider>
              <Component {...pageProps} />
            </CartProvider>
          </CurrencyProvider>
        </QueryClientProvider>
      </OpenFeatureProvider>
    </ThemeProvider>
  );
}

MyApp.getInitialProps = async (appContext: AppContext) => {
  const appProps = await App.getInitialProps(appContext);

  return { ...appProps };
};

export default MyApp;
