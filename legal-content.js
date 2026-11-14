// SaleFix disclosures. Accurate for both unconfigured and enabled integrations.
export const SUPPORT_EMAIL='hello.skyorigin@gmail.com';
const email='<a href="mailto:'+SUPPORT_EMAIL+'">'+SUPPORT_EMAIL+'</a>';
const policies={
  privacy:{
    label:'YOUR DATA & PRIVACY',title:'Privacy Policy',intro:'How we handle the files, links and details that you choose to share.',
    items:[
      ['What you submit','You may upload digital product files, provide a public selling-page URL, and add an optional description of up to 500 characters. File extraction occurs in your browser; only capped text excerpts, file names and structural metadata are sent to the audit server, not original uploaded binaries. Never submit card details, passwords, private customer lists or material you lack rights to use.'],
      ['Our use of data','We analyze readable excerpts and public sales-page content to produce grounded product and messaging suggestions. We use pseudonymous request identifiers for abuse prevention. An audit does not access private dashboards or prove future conversions or earnings.'],
      ['AI and service providers','When the operator configures Gemini, relevant public page details and extracted file text may be sent to Google for suggestions. Deeper AI file review is off by default. Vercel hosts SaleFix. When paid checkout is activated, Dodo Payments processes card payments, Upstash Redis stores transaction, access and publication records, and Resend sends purchase links. SaleFix does not collect full card numbers.'],
      ['Storage and retention','The free audit may remain in browser sessionStorage and paid kit edits in browser localStorage until cleared. If enabled, unfulfilled orders may be stored for up to 90 days, verified purchases and public pages for up to 365 days, and event replay identifiers for up to 30 days. Providers may retain operational logs according to their published terms.'],
      ['Sharing, location and security','We do not sell submitted product details to advertisers. Hosting, payment, AI and email processors may operate in other countries. Reasonable safeguards are used, but online services cannot promise perfect security.'],
      ['Your choices','You can omit optional details, clear site storage and ask for access, correction or deletion where law permits. Billing records may need retention for fraud, tax or regulatory purposes. Email '+email+' using subject Privacy Request.'],
      ['Minors and policy updates','Use SaleFix only when legally permitted to enter the applicable transactions. If a minor has provided personal information without necessary consent, contact support. The policy will be updated when data practices change.']
    ]
  },
  terms:{
    label:'USING SALEFIX',title:'Terms of Service',intro:'The rules for the free audit, optional purchase and publishing tools.',
    items:[
      ['The service','SaleFix reviews readable digital-product files and publicly accessible sales-page content to generate suggestions. It may miss blocked pages, dynamic content or unreadable material. Paid features require a configured merchant, webhook, durable store and email fulfillment and may remain unavailable while setup is incomplete.'],
      ['Your content and responsibilities','Only upload or link material you own or are authorized to analyze. Check every suggested claim before use. You are responsible for the accuracy of your product, compliance, real checkout link, delivery obligations and any buyer communications. Do not create misleading earnings claims, fake testimonials or illegal offers.'],
      ['Ownership of materials','You retain your rights to submitted materials. You authorize processing only as needed to deliver the requested service. You may edit and use lawful generated materials, but must respect other parties’ intellectual property rights.'],
      ['No prediction of sales','A content audit is not a conversion forecast and no number of sales, customers or earnings is promised.'],
      ['Pricing and purchase conditions','When enabled, one product campaign Sales Kit costs US$29 once, not a subscription. If checkout is unavailable, SaleFix cannot start a paid order. Any taxes and supported payment currencies are displayed by the payment provider. Review the <a href="#/refunds">Refund Policy</a> before paying.'],
      ['Publishing','Paid buyers may publish a public sales page that links to their existing checkout. Pages and asset edits must be reviewed by the buyer. Hosted page records can expire after 365 days and availability depends on the continued operation of the service. Do not publish private information or deceptive claims.'],
      ['Service availability and abuse','Do not attempt to overload services, bypass access controls or abuse file scanning. We may limit unreasonable traffic and remove or suspend abusive published content where lawful. We may alter or discontinue features, subject to applicable consumer protections.'],
      ['Support and rights','Nothing excludes mandatory consumer protections. Contact '+email+' for support, legal questions or complaints.']
    ]
  },
  refunds:{
    label:'BILLING & PURCHASES',title:'Refund Policy',intro:'Information about optional US$29 digital-product purchases.',
    items:[
      ['Payment availability','The free product audit does not require payment. US$29 checkout is only offered if secure merchant checkout, payment verification, email delivery and access recovery are configured. If unavailable, no order can be started.'],
      ['Delivery and access','Once the payment provider confirms a successful purchase and the webhook is verified, an access link is sent to the email used during checkout. Links expire after 7 days; the buyer may request a fresh link from the purchase-recovery screen.'],
      ['Eligible issues','If you are charged twice, do not receive delivery or encounter a material defect, email us within 7 days for prompt investigation. If the issue cannot be resolved, eligible refunds are processed through the original payment provider, without limiting applicable statutory rights.'],
      ['Digital purchases','Digital assets may be delivered immediately. A change of mind after delivery does not automatically entitle a buyer to a refund, but mandatory consumer cancellation and refund laws continue to apply. Sales results and income are not promised.'],
      ['Request a refund','Email '+email+' with subject SaleFix Refund Request. Include your checkout email, purchase date, receipt reference if available, and a short description. Never share complete card numbers or passwords.'],
      ['Refund processing','Any approved refund is routed through the payment provider to the original payment method. The provider and financial institution determine settlement timing.']
    ]
  },
  contact:{
    label:'GET IN TOUCH',title:'Contact & Support',intro:'Help with your product audit, purchase and data choices.',
    items:[
      ['Email support','For technical issues, purchase recovery, privacy or other questions, contact '+email+'. Avoid sharing passwords, confidential documents and full card details.'],
      ['Trouble scanning a link','Some stores block automated reading. Instead, upload your own product files for an evidence-based review. When reporting a problem, include the public URL and device/browser if helpful.'],
      ['Purchases','If paid checkout is active, an access link is emailed after verified payment. Visit <a href="#/recover">Purchase recovery</a> if you need a fresh link, or review the <a href="#/refunds">Refund Policy</a>.'],
      ['Privacy and legal inquiries','Email '+email+' with subject Privacy Request or Legal Inquiry. Requests are handled in line with applicable law and actual data practices.']
    ]
  }
};
export function legalContent(which){
  const d=policies[which]||policies.terms;
  const body=d.items.map(([name,copy])=>'<section class="lp-section"><h2>'+name+'</h2><p>'+copy+'</p></section>').join('');
  const links=[['privacy','Privacy Policy'],['terms','Terms of Service'],['refunds','Refund Policy'],['contact','Contact & Support']]
    .map(([key,name])=>'<a class="'+(key===which?'is-current':'')+'" href="#/'+key+'">'+name+'</a>').join('');
  return '<main class="container lp-wrap"><div class="lp-top-links"><a href="#/">← Back to SaleFix</a><a href="mailto:'+SUPPORT_EMAIL+'">Contact support ↗</a></div><header class="lp-heading"><span class="lp-eyebrow">'+d.label+'</span><h1>'+d.title+'</h1><p>'+d.intro+'</p><span class="lp-updated">Last updated: November 14, 2026</span></header><div class="lp-layout"><article class="lp-document surface">'+body+'<div class="lp-endnote">Questions? Contact '+email+'.</div></article><aside class="lp-side"><div class="lp-side-card surface"><h3>Information & policies</h3><nav aria-label="Legal pages">'+links+'</nav><div class="lp-side-email"><span>Need assistance?</span><a href="mailto:'+SUPPORT_EMAIL+'">'+SUPPORT_EMAIL+'</a></div></div></aside></div></main>';
}
