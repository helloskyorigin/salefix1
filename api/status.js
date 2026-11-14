import {commerceReady} from '../lib/payment.js';
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  return res.status(200).json({
    checkoutReady:commerceReady(),
    publishingReady:commerceReady(),
    aiFileReviewEnabled:Boolean(process.env.GEMINI_API_KEY&&process.env.SALEFIX_ENABLE_FILE_AI==='true'),
    aiHeadlineEnabled:Boolean(process.env.GEMINI_API_KEY&&process.env.SALEFIX_ENABLE_HEADLINE_AI==='true')
  });
}
