Deno.serve(() => Response.json(
  { error: "AI Call Intell has been retired." },
  { status: 410 },
));
