const required = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];

export function missingDeployEnv(env = process.env) {
  return required.filter((name) => !env[name] || !env[name].trim());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const missing = missingDeployEnv();
  if (missing.length) {
    console.error(`Deploy preflight failed. Missing required secrets: ${missing.join(', ')}.`);
    console.error('Add them as GitHub repository secrets; nothing was deployed.');
    process.exit(1);
  }
  console.log('Deploy preflight passed: required credentials are set (values not shown).');
}
