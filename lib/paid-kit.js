import crypto from 'node:crypto';

const b64 = value => Buffer.from(value).toString('base64url');
const tidy = (value, max=500) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0,max);
const safeUrl = value => { try { const url=new URL(value); if (url.protocol!=='https:' && url.protocol!=='http:') return ''; if(url.username||url.password) return ''; return url.toString(); } catch {return '';} };

/** Call ONLY with a completed, independently verified payment record from a trusted webhook. */
export function issueKitAccess(record, secret, now=Math.floor(Date.now()/1000)) {
  if(!secret || secret.length<32) throw Error('Kit signing secret is not configured.');
  if(record?.verifiedProviderEvent!==true || record?.status!=='succeeded' || record?.amountCents!==4900 || record?.currency!=='USD' || !record?.paymentId || !record?.email) throw Error('A verified $49 payment is required.');
  const p=record.product||{};
  if(!safeUrl(p.url)||!tidy(p.title,140)) throw Error('A valid purchased product campaign is required.');
  const payload={v:1,id:tidy(record.paymentId,120),email:tidy(record.email,254),iat:now,exp:now+7*24*3600,product:{url:safeUrl(p.url),title:tidy(p.title,140),description:tidy(p.description,1500),price:tidy(p.price,32),audience:tidy(p.audience,140),benefit:tidy(p.benefit,500),headline:tidy(p.headline,160)}};
  const body=b64(JSON.stringify(payload));
  const sig=crypto.createHmac('sha256',secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyKitAccess(token, secret, now=Math.floor(Date.now()/1000)) {
  if(!secret || secret.length<32) throw Error('Kit access is not configured.');
  if(typeof token!=='string'||token.length>6000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) throw Error('A valid purchase access link is required.');
  const [body,signature]=token.split('.');
  const expected=crypto.createHmac('sha256',secret).update(body).digest();
  const actual=Buffer.from(signature,'base64url');
  if(expected.length!==actual.length || !crypto.timingSafeEqual(expected,actual)) throw Error('This purchase link could not be verified.');
  let payload;try{payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));}catch{throw Error('Invalid purchase access link.');}
  if(payload.v!==1 || !Number.isSafeInteger(payload.exp)||payload.exp<=now ||payload.iat>now+120 || !payload.id || !safeUrl(payload.product?.url) || !payload.product?.title) throw Error('This access link expired or is invalid.');
  return payload;
}

export function buildPaidKit(verified) {
  const p=verified.product||{};
  const title=tidy(p.title,140)||'Your digital product';
  const desc=tidy(p.description,750);
  const audience=tidy(p.audience,130);
  const benefit=tidy(p.benefit,220);
  const checkoutUrl=safeUrl(p.url);
  const headline=tidy(p.headline,160)|| (benefit?`${title} — ${benefit}`:title);
  const audienceText=audience?` for ${audience}`:'';
  const factualDetail=desc || (benefit ? benefit : `Explore ${title} and its product details.`);
  const detail=desc || `Learn about ${title} and what's included.`;
  const lines=[
    `I made ${title}${audienceText}. Here's what it's about: ${factualDetail}\n\nExplore it: ${checkoutUrl}`,
    `If you're looking into ${title}, here's a quick overview:\n\n${factualDetail}\n\nDetails: ${checkoutUrl}`,
    `A question for ${audience||'digital creators'}: what's the hardest part of finding a useful resource for your next project?\n\nI put together ${title}: ${checkoutUrl}`,
    `Here's what I'm sharing today: ${title}.\n\n${factualDetail}\n\nSee the full product: ${checkoutUrl}`,
    `Sometimes the best way to understand a resource is to see exactly what it covers.\n\n${title}: ${factualDetail}\n\n${checkoutUrl}`,
    `Working on something related to ${title}?\n\nHere's the product description: ${factualDetail}\n\nTake a look: ${checkoutUrl}`,
    `Before you buy any digital resource, check the actual contents and whether they fit your goals.\n\nHere's mine: ${title} — ${checkoutUrl}`,
    `A quick introduction to ${title}:\n\n${factualDetail}\n\nQuestions about it? Feel free to ask. ${checkoutUrl}`,
    `Made a resource I think is worth a closer look: ${title}.\n\nHere's what it offers: ${factualDetail}\n\n${checkoutUrl}`,
    `If you're evaluating ${title}, read the actual description before deciding.\n\n${factualDetail}\n\nProduct page: ${checkoutUrl}`
  ];
  const replies=[
    {q:'What is included?',a:`Here's the product description for ${title}: ${detail} You can check the details here: ${checkoutUrl}`},
    {q:'How do I get it?',a:`The product page has the latest purchase and delivery details: ${checkoutUrl}`},
    {q:'Who is it for?',a:audience?`${title} is intended for ${audience}. Please check the description to decide whether it fits your needs: ${checkoutUrl}`:`Please check the product details to see whether ${title} matches your needs: ${checkoutUrl}`},
    {q:'Is this right for me?',a:`That depends on what you're trying to accomplish. Here's the full description so you can judge for yourself: ${detail} ${checkoutUrl}`},
    {q:'Can I see more?',a:`You can see the available details for ${title} here: ${checkoutUrl}. Let me know if there's a specific part you're curious about.`}
  ];
  const days=[
    ['Introduce the product','Share the clearest description and why you made it.'],
    ['Share a practical insight','Teach something relevant without making unsupported promises.'],
    ['Answer a buyer question','Explain who the product is for and link to details.'],
    ['Show real product contents','Use an authentic screenshot, sample or outline if available.'],
    ['Discuss a common challenge','Invite a genuine conversation with your audience.'],
    ['Explain the offer clearly','Restate the actual features, format and checkout route.'],
    ['Review the response','Look at real questions and clicks; update your copy.']
  ].map(([name,task],i)=>({day:i+1,name,task}));
  return {campaignId:tidy(verified.id,120),product:{title,description:desc,price:tidy(p.price,32),url:checkoutUrl,audience,benefit},headline,subheadline:detail,posts:lines,replies,plan:days,graphics:[{name:'Product announcement',style:'blue'},{name:'Product highlight',style:'purple'},{name:'Quick introduction',style:'mint'}],email:tidy(verified.email,254),issuedAt:verified.iat,accessExpiresAt:verified.exp,note:'Suggestions are built from your supplied or readable product details. Review before publishing. No claims of revenue or customer results are generated.'};
}
