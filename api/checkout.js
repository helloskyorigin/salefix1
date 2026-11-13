// IMPORTANT: Never take customer money without verified fulfillment.
// Checkout stays closed until Dodo webhook verification, secure buyer access,
// and one-click publishing are wired and tested end-to-end.
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.status(503).json({error:'Secure checkout is not connected yet. Please finish payment and fulfillment setup before launch.'});
}
