---
layout: post
title: "Proofs of Personhood"
date: 2026-01-28
permalink: /blogposts/proofs-of-personhood.html
description: "A new cryptographic framework for proofs of personhood."
nav_active: blog
authors:
  - Arka Rai Choudhuri
featured_image: 
---

I want to briefly discuss our recent work on proofs of personhood. This is joint work with my collaborators Sanjam Garg, Keewoo Lee, Hart Montgomery, Guru Vamsi Policharla, and Rohit Sinha. You can find the paper [here]().

The motivating question is simple: how does one prove personhood online? Early systems like CAPTCHA[^1] were very influential in attempting to verify humanness, but modern ML systems have significantly weakened their security assumptions. More importantly, personhood is not only about proving "I am human." In many online settings, we also need to prove relationship-backed trust, reputation, or context-specific endorsements. These guarantees should also preserve user privacy.

It would seem that we already have the tools needed for a cryptographic solution. In particular, there has been incredible effort to make both digital credentials and, separately, zero-knowledge (ZK) proofs practical and widely deployable. In light of this, it is natural to combine these tools to prove properties about yourself and your relationships to others. However, an ad-hoc approach can yield an incomplete solution at best, and a privacy-breaking solution at worst. Evaluating proposed solutions is also challenging because there are no standard formal security requirements.



In our work, we initiate the study of a cryptographic framework for proofs of personhood. The contributions of our work include:
- Formalizing the security requirements of proofs of personhood. 
- Constructing proofs of personhood using existing cryptographic tools by identifying the exact properties required from these tools.

In the paper we also present efficient versions of the underlying tools, with experimental evaluations.


In the rest of this blog, instead of providing the security definition up front, we walk through a typical protocol using a running example. In the process, we also highlight the key ideas and the security requirements for each stage.


## Stage I: Personhood Credential Issuance

At the top level are entities we call **issuers** (or credential authorities), whose identity and public keys are publicly known or easily retrievable. They issue credentials to users and can range from local organizations (for example, a restaurant loyalty program) to government authorities (for example, a passport office).

The first step in our protocol is for a user to obtain a **personhood credential** from an issuer on selected attributes. In the running example, Bob is a professor at **University of X** and wants the university to issue a personhood credential on the following attributes.

<div class="jellyk-code-box">
<pre><code>att = {
  Name = Bob
  Occupation = Cryptographer
  Position = Professor
  Office phone = 123-4567
}</code></pre>
</div>

The university also has a publicly known key `ipk`. Because Bob wants to use this credential online, he reveals a public key `pk` along with `att` to the university. Bob first proves knowledge of the secret key corresponding to `pk`, and then interacts with the issuer as in the figure below to obtain a credential `cred` on the tuple `att || pk`.

<figure class="jellyk-figure"  style="max-width: 20rem; margin-left: auto; margin-right: auto;">
    <img src="/assets/images/test.png" alt="Describe image">
    <figcaption>PHC Issuance.</figcaption>
  </figure>

Bob is able to locally verify the validity of the credential using the university's public key `ipk`.


<div class="jellyk-highlight-box">
    <p><strong>PHC Unforgeability.</strong> The first security requirement is that credentials cannot be forged.</p>
</div>

However, there is already a privacy concern in the above flow: multiple issuers that interact with Bob can link those interactions simply by observing `pk`, even when Bob does not reveal his name in some credential issuances.

<div class="jellyk-highlight-box">
    <p><strong>PHC Receiver Unlinkability.</strong> Multiple issuers cannot link credentials issued to the same user (on different attributes).</p>
</div>

To fix this, the user derives an **issuer-specific public key** `pk_issuer` as a deterministic function of their secret key `sk` and the issuer's public key `ipk`. For example:

<div class="jellyk-code-box">
<pre><code>pk_issuer = PRF_sk(ipk)</code></pre>
</div>

The pseudorandomness of the PRF ensures that even colluding issuers cannot link credentials issued to the same user. Finally, rather than proving ownership of `pk` directly, Bob proves in zero knowledge that `pk_issuer` was correctly derived from `(sk, ipk)`.

Before moving on to the next stage, we briefly note how one determines the validity of the attributes themselves.

### Sidebar: Attribute Verification Oracles

A natural question is how an issuer determines whether Bob's attributes are valid. In many systems, this step is handled outside the cryptographic model, and we simply assume the issuer uses its own validation process to decide whether to issue a credential.

When a user presents a credential together with its issuer, we implicitly make a judgment about the issuer's quality: *How likely is this issuer to be fooled into certifying invalid attributes?*

We embed these judgments as confidence (or error) parameters `e_I` for each issuer `I`. We think of each issuance of a credential as a *noisy* process, prone to errors, and `e_I` is roughly a bound on how often an issuer is likely to issue a credential for invalid attributes (lower is better).

This gives a practical way to reason about mis-issuance in real deployments: whenever a credential is checked, the verifier can account for which issuer signed it and calibrate trust based on that issuer's confidence parameter. At the same time, the protocol still provides strong privacy and robustness guarantees at the cryptographic layer.

---

## Stage II: Verifiable Relationship Credentials (VRCs)

A user with a valid personhood credential can vouch for statements about other users.

At a high level, a VRC captures a statement endorsed by an issuer-user about a receiver-user. Unlike PHC issuance, this step can be done in a single interaction. In the running example, Alice asks Bob to vouch for the statement:

<div class="jellyk-code-box">
<pre><code>st = "Is a cryptographer."</code></pre>
</div>

However, Bob does not want to reveal the same long-lived key material each time he issues a VRC, since that would make his interactions linkable. Instead, Bob derives a context-specific key for `context = conference`:

<div class="jellyk-code-box">
<pre><code>pk_context = PRF_sk(ipk || context)</code></pre>
</div>

<div class="jellyk-highlight-box">
    <p><strong>VRC Issuer Cross-Context Unlinkability.</strong> Interactions in different contexts should not be linkable to the same issuer-user.</p>
</div>

Similarly, as in PHC issuance, we do not want different VRC issuers to link Alice across interactions. Alice therefore uses a fresh receiver key derived from the issuer context key:

<div class="jellyk-code-box">
<pre><code>pk_vrc = PRF_sk'(pk_context)</code></pre>
</div>

<div class="jellyk-highlight-box">
    <p><strong>VRC Receiver Unlinkability.</strong> Multiple VRC issuers should not be able to link VRCs issued to the same receiver.</p>
</div>

Bob reveals only:

<div class="jellyk-code-box">
<pre><code>att' = {
  Name = Bob
  Occupation = Cryptographer
}</code></pre>
</div>

Using credential `cred`, Bob generates a VRC bound to `(pk_vrc || st)`.

The issued VRC is bound to the following values:

<div class="jellyk-code-box">
<pre><code>vrc = (
  ipk,
  att',
  pk_context,
  pk_vrc,
  st
)</code></pre>
</div>

Anyone can verify the VRC against Bob's revealed attributes and keys, together with zero-knowledge proofs that `pk_context` and `pk_vrc` were correctly derived.

This gives the following requirements for VRC issuance:

<div class="jellyk-highlight-box">
  <p><strong>VRC Unforgeability.</strong> No one should be able to create a valid VRC without an underlying valid credential and a valid proof flow from the issuer-user.</p>
</div>

<div class="jellyk-highlight-box">
  <p><strong>VRC Issuance Attribute Hiding.</strong> The attributes not revealed during a VRC issuance remain hidden.</p>
</div>

---

## Stage III: Showing VRCs

Once a user has collected verifiable relationship credentials (VRCs), they can use them to prove complex assertions to a verifier. For both privacy and efficiency reasons, the user does not directly hand over these VRCs. Instead, they produce a **zero-knowledge proof**.


Alice wants to prove:

<div class="jellyk-claim-box">
  <p><strong>Claim.</strong> Three different cryptographers vouched for me as a cryptographer.</p>
</div>

Suppose Alice has VRCs of the form:

<div class="jellyk-code-box">
<pre><code>(vrc_i, ipk_i, att'_i, pk_context_i, pk_vrc_i, st_i)
for i in [3]</code></pre>
</div>

Alice then proves in zero knowledge that:

- all VRCs are valid  
- all statements equal "Is a cryptographer"  
- issuer keys are distinct
- all receiver keys were correctly derived from Alice's secret key

She sends the proof `Pi` and the corresponding issuer identities.
The verifier checks the proof and decides whether to trust the underlying issuers.

Because receiver keys are derived per interaction:

- The proof should show all `pk_vrc_i` values come from the same receiver secret key, without revealing that key.

Because issuer keys are context-derived:

- Distinct issuer-side keys may correspond to different contexts for the same issuer-user.
- Verifier logic should account for the intended context policy.

<div class="jellyk-highlight-box">
  <p><strong>Showing Privacy.</strong> The verifier learns only the claimed aggregate statement (and issuer information needed for trust calibration), not Alice's full VRC set.</p>
</div>



## Conclusion

In this blog post, we intentionally stayed informal in describing the protocol and its guarantees. In the paper, however, we capture the entire target behavior in a single ideal functionality, which is important because it requires all security properties to hold simultaneously, not in isolation.

That viewpoint makes tradeoffs explicit and disciplined: any construction must realize one coherent security target, rather than a collection of loosely connected goals. It also enables a modular design strategy, where we identify the exact properties needed from underlying tools so improvements in those tools translate directly into better end-to-end protocols.

## References

[^1]: https://link.springer.com/chapter/10.1007/3-540-39200-9_18
