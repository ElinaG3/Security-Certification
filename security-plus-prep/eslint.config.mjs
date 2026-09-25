import nextConfig from 'eslint-config-next';

const config = [{ ignores: ['legacy/**'] }, ...nextConfig];

export default config;
