// Shared fail-closed gate for publication and the intentional failure probe.
try {
  const results = JSON.parse(process.env.RESULTS || 'null');
  const names = ['validate', 'sql', 'browser'];
  if (!results || Object.keys(results).length !== names.length || names.some(name => results[name]?.result !== 'success')) {
    throw new Error('Validation gate rejected: validate, sql and browser must all succeed.');
  }
  console.log('Validation gate passed.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
