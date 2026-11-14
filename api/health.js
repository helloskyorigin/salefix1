// Cheap health endpoint to confirm Vercel Node Functions are deployed.
// No credentials, environment variables, or user information are exposed.
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'&&req.method!=='HEAD')return res.status(405).json({error:'Method not allowed'});
  return res.status(200).json({ok:true,service:'salefix',component:'api'});
}
