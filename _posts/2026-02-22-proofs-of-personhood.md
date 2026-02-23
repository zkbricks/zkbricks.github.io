---
layout: post
title: "Proving Personhood Without Handing Over the Keys"
date: 2026-02-22
permalink: /blogposts/proofs-of-personhood.html
description: "A new cryptographic framework for proofs of personhood."
nav_active: blog
authors:
  - Arka Rai Choudhuri
  - Sanjam Garg
featured_image: /assets/images/proofs-personhood-handing-keys.png
---



*“On the Internet, nobody knows you’re a dog.”* The famous 1993 New Yorker cartoon ([Wikipedia](https://en.wikipedia.org/wiki/On_the_Internet,_nobody_knows_you%27re_a_dog)) was a joke—but it pointed at a real problem. How do you know you’re interacting with a real human online? Or a human of the right age, with the right credentials? Today that question is sharper than ever.
<figure class="jellyk-figure" style="max-width: 14rem; margin: 1.25rem auto;">
  <img src="/assets/images/proofs-personhood-nobody-knows-dog.png" alt="On the Internet, nobody knows you're a dog" class="img-fluid rounded">
  <figcaption class="small text-body-secondary mt-2">Who's on the other side? Sometimes even "verified" isn't.</figcaption>
</figure>


<div class="row g-3 my-4">
  <div class="col-12 col-md-6">
    <figure class="jellyk-figure mb-0" style="max-width: 18rem; margin-left: auto; margin-right: auto;">
      <img src="/assets/images/proofs-personhood-phone-calls.png" alt="Phone overwhelmed by unknown calls" class="img-fluid rounded">
      <figcaption class="small text-body-secondary mt-2">Who's really on the other end? It's getting harder to tell.</figcaption>
    </figure>
  </div>
  <div class="col-12 col-md-6">
    <figure class="jellyk-figure mb-0" style="max-width: 16rem; margin-left: auto; margin-right: auto;">
      <img src="/assets/images/proofs-personhood-captcha-fails.png" alt="Akirabot passing a human verification" class="img-fluid rounded">
  <figcaption class="small text-body-secondary mt-2">Bots like Akirabot[^3] can pass the "prove you're human" test. We need something stronger.</figcaption>
    </figure>
  </div>
</div>



Have you noticed more calls and messages from unknown senders—someone “just trying to help”? Often it’s a scammer or an ad-bot that sounds just like a human. We’re at the beginning of a reality where what you see or hear online may not be real. Are we prepared?


Early systems like CAPTCHA[^1] (Eurocrypt ’03) were built on a simple idea: give the user a task that’s easy for humans but hard for machines. For a while they worked. Today they’re essentially broken. LLMs and other ML tools can defeat CAPTCHAs at scale—for example, Akirabot[^3], an OpenAI-based tool, was used to hit **420,000 sites** with spam by bypassing CAPTCHAs. We can no longer rely on humans being “smarter” than bots.

And personhood isn’t only “am I human?” Online we also need **relationship-backed trust**, **reputation**, **membership in a community**, or **context-specific endorsements**—age verification, attestations, “who vouches for you”—and all of that should preserve privacy. Yet many current approaches are ad-hoc and privacy-hostile. Mobile driver’s licenses (mDLs) can let the verifier query the DMV on every check, so the DMV can see and record every verification. Discord had **over 70,000 government IDs** stolen, then required government ID for “adult” content. Worldcoin’s global biometric system has been called a “privacy nightmare” and has faced shutdowns or strict limits in Spain, Bavaria, Hong Kong, and Kenya. So: *how do we prove personhood without handing over the keys?*

<div class="row g-3 my-4">
  <div class="col-12 col-md-6">
    <figure class="jellyk-figure mb-0" style="max-width: 14rem; margin-left: auto; margin-right: auto;">
    <img src="/assets/images/proofs-personhood-trust-badges.png" alt="Trust, reputation, and endorsements" class="img-fluid rounded">
    <figcaption class="small text-body-secondary mt-2">It’s not just “am I human?”—it’s trust, reputation, and who stands behind you.</figcaption>
    </figure>
  </div>
  <div class="col-12 col-md-6">
    <figure class="jellyk-figure mb-0" style="max-width: 16rem; margin-left: auto; margin-right: auto;">
      <img src="/assets/images/proofs-personhood-handing-keys.png" alt="Handing over the keys" class="img-fluid rounded">
      <figcaption class="small text-body-secondary mt-2">Proving who you are shouldn't mean handing over the keys.</figcaption>
    </figure>
  </div>
</div>

In this blog we explain our recent work[^2]: we show how to construct proofs of personhood so that humans can prove their reputation and credentials online in a **privacy-preserving** way. The design is **decentralized**—no reliance on centralized parties for setup—and we use **zero-knowledge (ZK) proofs** so people can prove what they need without leaking the rest. This work contributes to the vision of the [First Person Network](https://www.firstperson.network/)[^4]: a global infrastructure for real people and real trust, with no intermediaries. Below we walk through a typical protocol with a running example and highlight the key ideas and security requirements at each stage. No prior work considers the goal of constructing efficient zk proofs for this setting.

## Stage I: Getting a Personhood Credential

Someone has to vouch that you're a real person before you can vouch for others. We call these vouchers **issuers**: organizations everyone can look up and trust. They might be your local DMV, a passport office, or even a loyalty program. In practice, many personhood systems use **government-issued IDs** (passports, mobile driver's licenses) as the "one person, one credential" anchor—and our protocol supports that. 

**Alex** is a ride-share driver. Alex goes to a **government authority** (say, the DMV or a passport office) and gets a **personhood credential** (PHC) that attests to some facts about him—for example:

<div class="jellyk-code-box">
<pre><code>att = {
  Name = Alex
  Occupation = Driver
  License type = Commercial
  Date of birth = 1990-05-15
}</code></pre>
</div>

The authority has a public key that anyone can check. Alex provides his own public key and these attributes, proves he owns the provided key, and goes through the issuance flow. At the end, he holds a credential that he can verify himself using the authority's public key. No one can fake that credential—that's our first guarantee:

<div class="jellyk-highlight-box">
    <p><strong>PHC Unforgeability.</strong> Credentials cannot be forged.</p>
</div>

**But wait—privacy.** If Alex used the *same* public key with every issuer, then different issuers could link his requests together and learn more about him than he intended. We don't want that. So we require:

<div class="jellyk-highlight-box">
    <p><strong>PHC Receiver Unlinkability.</strong> Different issuers cannot link credentials issued to the same person.</p>
</div>

The fix: Alex **derives a different-looking public key for each issuer** from his secret key and that issuer's public key—so each key looks unrelated to the others. To each issuer he only shows this derived key; they can't tell it's the same person going to another issuer. He proves in zero knowledge that the derived key was computed correctly, without revealing his master secret.

**A quick note on trust.** How does the issuer know Alex's details are real? In the real world, that's the issuer's job (e.g. the DMV checks your documents). For added robustness, we allow for the fact that issuers can sometimes be fooled: we attach a **confidence parameter** to each issuer. When someone later checks a credential, they can weigh *who* issued it. The protocol still keeps privacy and security even when we don't assume every issuer is perfect.

---

## Stage II: Vouching for Others (Verifiable Relationship Credentials)

Once you have a personhood credential, you can **vouch for someone else** in a way that others can check. We call these **verifiable relationship credentials (VRCs)**. Think of them as signed, checkable endorsements. We refer to these VRC issuers as *vouchers*, to distinguish them from *issuers*, who only issue PHCs. 

**Back to our example.** **Carol** is a passenger who just had a great ride with Alex. She has her own personhood credential (from the government or another issuer). She wants to endorse Alex by saying:

<div class="jellyk-code-box">
<pre><code>st = "Is a good driver."</code></pre>
</div>

She doesn't want every endorsement to be linkable to the same "Carol." So she uses a **context-specific key** for the ride-share setting. In fact, even issuers cannot link a PHC issuance with an endorsement. Different contexts (ride-share, work, social) get different keys, so no one can tie all her vouchers together.

<div class="jellyk-highlight-box">
    <p><strong>Voucher Cross-Context Unlinkability.</strong> Your endorsements in one context (e.g. ride-share) cannot be linked to you in another context.</p>
</div>

Alex has the same kind of privacy need: he doesn't want every passenger who vouches for him to see that he's the same driver across all of them. So he uses a **fresh receiver key** for this interaction, derived from Carol's context key. Different passengers see different keys; they can't link Alex across his VRCs.

<div class="jellyk-highlight-box">
    <p><strong>VRC Receiver Unlinkability.</strong> Vouchers cannot link those VRCs to the same person (you) across different vouchers.</p>
</div>

Carol only reveals what she chooses—for example, just her name—and the rest of her attributes stay hidden. She uses her credential to create a VRC bound to Alex's receiver key and the statement "Is a good driver." Anyone can check that the VRC is valid and that the keys were derived correctly (via zero-knowledge proofs), without learning Carol's or Alex's secrets. One more guarantee:

<div class="jellyk-highlight-box">
  <p><strong>VRC Unforgeability.</strong> No one can create a valid endorsement without holding a real credential and going through the proper issuance flow.</p>
</div>

---

## Stage III: Proving Your Reputation (Without Revealing Everything)

Alex has collected several "good driver" endorsements from passengers. Now he wants to **prove** to someone—the ride-share platform, or a new passenger—that he has that reputation, *without* handing over every VRC he's ever received. That would be slow and would leak more than needed. Instead, he produces a **zero-knowledge proof**: one short proof that backs up his claim.

<div class="jellyk-claim-box">
  <p><strong>Claim.</strong> Three different passengers vouched for me as a good driver.</p>
</div>

The proof shows, in zero knowledge, that: (1) he holds three valid VRCs, (2) each says "Is a good driver," (3) they come from three *different* vouchers (so not one person vouching three times), (4) each VRC was issued by a voucher with a valid PHC from a trusted issuer (or approved issuer set), and (5) all of the VRCs were issued to the *same* receiver, namely Alex, without revealing his secret key. He sends this proof plus the identities of the issuers (so the verifier can decide how much to trust them). The verifier checks the proof and can accept or reject the claim.

**Privacy in this step:** The verifier only learns the *claim* ("three passengers said I'm a good driver") and whatever issuer info is needed to calibrate trust. They do *not* learn Alex's full set of VRCs, his keys, or any attributes he didn't choose to reveal.

<div class="jellyk-highlight-box">
  <p><strong>Showing Privacy.</strong> The verifier learns only the claimed statement and the issuer information needed for trust, not the full set of VRCs or hidden attributes.</p>
</div>



## Wrapping Up

This post conveys the flow and the guarantees of our system without the full formal machinery. We refer the reader to our paper[^2] for the full definitions, constructions, and experiments. 

In our paper we present an early prototype showing that zero-knowledge proofs for this setting can be practical. We leave further efficiency improvements for future work. Additionally, going forward, we aim to add support for legacy credentials in our system.
We also want to support proving membership in a community where trust is defined by being directly connected to a trust anchor or to a sufficient number of other members in the community.

<div class="jellyk-figure" style="padding: 0.5rem;">
  <iframe
    src="https://eprint.iacr.org/2026/333.pdf"
    title="A Cryptographic Framework for Proofs of Personhood (PDF)"
    style="width: 100%; height: 70vh; border: 0;"
  ></iframe>
</div>

## References

[^1]: Luis von Ahn, Manuel Blum, Nicholas J. Hopper, and John Langford. **CAPTCHA: Using Hard AI Problems for Security.** In *Advances in Cryptology — EUROCRYPT 2003*, pp. 294–311. Springer, 2003. [https://link.springer.com/chapter/10.1007/3-540-39200-9_18](https://link.springer.com/chapter/10.1007/3-540-39200-9_18)

[^2]: Arka Rai Choudhuri, Sanjam Garg, Keewoo Lee, Hart Montgomery, Guru Vamsi Policharla, and Rohit Sinha. **A Cryptographic Framework for Proofs of Personhood.** [PDF](https://eprint.iacr.org/2026/333.pdf)

[^3]: Akirabot — an OpenAI-based tool used to target 420,000 sites with spam by bypassing CAPTCHAs; see e.g. reporting on CAPTCHA-breaking attacks.

[^4]: **The First Person Network.** A global digital utility for trusted connections between individuals, communities, and organizations—no intermediaries, no platform, no surveillance. [firstperson.network](https://www.firstperson.network/)
