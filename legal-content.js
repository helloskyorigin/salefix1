// Public SaleFix policies. Keep statements aligned with the live checkout and data flow.
export const SUPPORT_EMAIL = "hello.skyorigin@gmail.com";
const email = '<a href="mailto:'+SUPPORT_EMAIL+'">'+SUPPORT_EMAIL+'</a>';
const sections = {
 privacy: {
  label:"YOUR DATA & PRIVACY",title:"Privacy Policy",intro:"How SaleFix handles product links, audit content and support requests.",
  items:[
   ["What you provide","When you run a free audit, you submit a public product URL. You may add your product name, audience, benefit and sales-page copy. Please only share material you have permission to use; never submit passwords, payment-card numbers, personal customer lists or confidential records."],
   ["Technical data and browser storage","The website host may process limited technical data, including IP addresses, request times, browser details and error logs, to deliver the service and protect it from abuse. The latest report is stored in your browser sessionStorage so you can navigate back to it. You can clear this using your browser settings. There is currently no mandatory account for the free audit."],
   ["How information is used","We use submitted URLs and details to read accessible public content, identify possible messaging problems, suggest wording improvements, troubleshoot errors, answer support requests and keep the service secure. The audit does not read your private sales dashboard and cannot verify your actual revenue or conversions."],
   ["AI, hosting and third parties","If server-side AI assistance is configured, relevant product content, uploaded-file text excerpts, audience and benefit text may be sent to the AI provider for headline and file-content suggestions. File-content AI review is off by default. When AI is not configured, the free audit uses accessible file text, metadata and page content for transparent automated advice. Original uploaded binaries are not sent to the analysis endpoint. Hosting providers can process operational data for service delivery. Future payments will be handled by an identified payment provider, with updated disclosures before checkout goes live."],
   ["Data storage and retention","Your browser retains sessionStorage until it is cleared or the browser session ends, depending on browser behavior. Operational logs may be held under the hosting provider's retention practices. We aim to minimize information we process. No internet system can be promised completely secure."],
   ["Sharing and transfers","We do not sell submitted product information to advertisers. We may share information with infrastructure or AI providers where necessary to provide the requested service or when the law requires it. Such providers may operate in other countries."],
   ["Your choices and rights","You may avoid optional fields, clear your browser site data or contact us to ask about access, correction or deletion where applicable. Requests are evaluated against the information we actually control and applicable law. Email "+email+" with subject Privacy Request."],
   ["Minors and changes","The tool is for users legally permitted to use online services. If you believe personal data of a minor has been submitted without necessary permission, contact us. We may update this policy when features or legal requirements change, and we will update the effective date."]
  ]},
 terms: {
  label:"USING SALEFIX",title:"Terms of Service",intro:"Clear terms for the free audit and any future paid digital kit.",
  items:[
   ["The service","SaleFix analyzes readable digital-product page content and suggests clearer headlines, benefits and purchase wording. Results depend on the publicly accessible data and your supplied information; blocked pages and dynamic content can limit what we can see. The paid Sales Kit, publishing and checkout are not live in the current release."],
   ["Your responsibilities","Only submit URLs or content you are authorized to analyze. You are responsible for the accuracy of your product claims, pricing, marketing, testimonials and legal compliance. Do not use SaleFix to impersonate others, fabricate reviews, promote unlawful products or make deceptive earnings claims."],
   ["Content and output","You retain your rights in material you submit. You give SaleFix and the providers needed to operate it permission to process that content for your requested audit. You may adapt output for lawful marketing, subject to third-party rights. Review all suggestions before publishing: AI-generated or automated wording can be wrong or incomplete."],
   ["No sales guarantees","A free audit is information about page content, not evidence of conversion rate or future revenue. SaleFix does not promise a particular number of views, leads, customers or sales."],
   ["Service protection","Do not misuse, attack, overload, bypass security limits, probe internal networks, access other users' data or automate excessive requests. We may limit abusive use to protect users and infrastructure."],
   ["Price and paid availability","The planned price for one product campaign kit is US$49 as a one-time purchase, not a subscription. Checkout is currently disabled; no payments are accepted. Before paid launch, the actual deliverables, payment conditions and "+'<a href="#/refunds">Refund Policy</a>'+" will be shown. Any applicable taxes and currency conversion are handled at checkout."],
   ["Service changes and limitations","Features may change as the product develops. Public third-party sites can block access or become unavailable. To the extent allowed by law, the service is provided as available and SaleFix cannot promise uninterrupted service."],
   ["Consumer rights and support","Nothing in these terms excludes legal consumer protections that cannot be waived. For complaints, legal notices or questions, contact "+email+"."]
  ]},
 refunds:{
  label:"BILLING & PURCHASES",title:"Refund Policy",intro:"How billing and digital-product delivery problems will be handled.",
  items:[
   ["Current payment status","SaleFix is not taking paid orders yet. The free audit requires no card. The planned one-time US$49 kit checkout will remain unavailable until content generation, delivery and buyer access are operational."],
   ["When paid checkout launches","After a future purchase, contact us within 7 calendar days if you were charged twice, the digital kit was not delivered, or a material technical defect prevents normal use. We will investigate and where an issue cannot reasonably be fixed, arrange a refund through the original payment method, subject to applicable consumer law and payment processor rules."],
   ["Digital delivery and expectations","Digital assets may become accessible immediately upon successful delivery. A change of mind after delivery does not automatically qualify for a refund. Sales or earnings outcomes are not promised. Statutory cancellation and refund rights still apply where required by law."],
   ["How to request help","Email "+email+" with subject SaleFix Refund Request. Include the email used at checkout, approximate purchase date, receipt reference if available, and a short description of the issue. Never send full card details, passwords or payment credentials."],
   ["Refund timing","If a refund is approved, it will be issued through the payment provider to the original method. The bank, card issuer or payment service controls when funds appear. Contacting us does not affect your right to raise a payment dispute with your provider."]
  ]},
 contact:{
  label:"GET IN TOUCH",title:"Contact & Support",intro:"Questions about SaleFix, technical issues, privacy and future purchases.",
  items:[
   ["Business & support email","Email "+email+" for technical help, website questions or business inquiries. Describe the page and issue, and if useful include the browser and device used. Do not attach confidential data or payment credentials."],
   ["Trouble analyzing a page","Some selling platforms block automated reading. If a URL cannot be fetched, try the manual product-copy option and paste only information you are allowed to share. Include the public URL when reporting a technical issue."],
   ["Billing and refunds","Payment is not yet available. If you need help with future transactions, see the "+'<a href="#/refunds">Refund Policy</a>'+" and use the support email above."],
   ["Data requests and legal inquiries","For data access, correction, deletion or legal requests, write to "+email+" using the subject Privacy Request or Legal Inquiry. We review requests in accordance with applicable law and actual data practices."]
  ]}
};
export function legalContent(which){
 const d=sections[which]||sections.terms;
 const body=d.items.map(([name,copy])=>'<section class="lp-section"><h2>'+name+'</h2><p>'+copy+'</p></section>').join('');
 const links=[["privacy","Privacy Policy"],["terms","Terms of Service"],["refunds","Refund Policy"],["contact","Contact & Support"]].map(([key,name])=>'<a class="'+(key===which?'is-current':'')+'" href="#/'+key+'">'+name+'</a>').join('');
 return '<main class="container lp-wrap"><div class="lp-top-links"><a href="#/">← Back to SaleFix</a><a href="mailto:'+SUPPORT_EMAIL+'">Contact support ↗</a></div><header class="lp-heading"><span class="lp-eyebrow">'+d.label+'</span><h1>'+d.title+'</h1><p>'+d.intro+'</p><span class="lp-updated">Last updated: November 13, 2026</span></header><div class="lp-layout"><article class="lp-document surface">'+body+'<div class="lp-endnote">Questions? Contact '+email+'.</div></article><aside class="lp-side"><div class="lp-side-card surface"><h3>Information & policies</h3><nav aria-label="Legal pages">'+links+'</nav><div class="lp-side-email"><span>Need assistance?</span><a href="mailto:'+SUPPORT_EMAIL+'">'+SUPPORT_EMAIL+'</a></div></div></aside></div></main>';
}