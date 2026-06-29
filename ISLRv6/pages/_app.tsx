import { AppProps } from 'next/app';
import '../styles/globals.css';


// Main App component
function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default MyApp;
