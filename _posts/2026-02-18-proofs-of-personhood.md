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

The first step in our protocol is for a user to obtain a **personhood credential** from an issuer on selected attributes. In the running example, we have a user Bob who is a professor at **University of X**. Bob wants the university to issue a personhood credential for the following attributes.

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

To fix this, the user derives an **issuer-specific public key** `pk_issuer` as a deterministic function of their secret key `sk` and the issuer public key `ipk`. For example:

<div class="jellyk-code-box">
<pre><code>pk_issuer = PRF_sk(ipk)</code></pre>
</div>

The pseudorandomness of the PRF ensures that even colluding issuers cannot link credentials issued to the same user. Finally, rather than proving ownership of `pk` directly, Bob proves in zero knowledge that `pk_issuer` was correctly derived from `(sk, ipk)`.

Before moving on to the next stage, we briefly note how one determines the validity of the attributes themselves.

### Sidebar: Attribute Verification Oracles

It is a fair question to ask how an issuer determines if Bob's attributes are 'correct'. For the most part this is treated simply outside of the purview of cryptographic modeling, and we simply assume that the issuer will 'use its judgement', and refuse to issue a credential. 

When a user uses a credential by specifying the user that issued it, we also implicitly make a judgement about the 'quality' of the issuer: *Is the issuer likely to be fooled into issuing a credential for an attribute that isn't "true"?*. 

We embed these judgements as confidence (or error) parameters `e_I` for each issuer `I`. We think of each issuance of a credential as a *noisy* process, prone to errors, and `e_I` is roughly a bound on how often an issuer is likely to issue a credential for invalid attributes (lower is better).

This gives a practical way to reason about mis-issuance in real deployments: whenever a credential is checked, the verifier can account for which issuer signed it and calibrate trust based on that issuer's confidence parameter. At the same time, the protocol still provides strong privacy and robustness guarantees at the cryptographic layer.

---

## Verifiable Relationship Credentials (VRCs)

A user with a valid personhood credential can vouch for statements about other users.

Unlike credential issuance, a VRC can be issued in a single message.

<!-- Insert diagram here if desired -->
<!-- ![VRC issuance](/assets/img/vrc.png) -->

### Example

Alice asks Bob to vouch for:

    st = "Is a cryptographer."

Bob reveals only:

    att' = {
      Name = Bob
      Occupation = Cryptographer
    }

Using credential `cred`, Bob generates a VRC for `(pk' || st)`.

The VRC contains:

- issuer key `ipk`
- selected attributes `att'`
- nullifier `null`
- Bob’s key
- Alice’s key `pk'`
- statement `st`

Anyone can verify the VRC.  
The nullifier can be checked against a revocation list.

### Unlinkability modifications

We want to prevent linkability across VRC interactions.

#### Receiver unlinkability

Receivers derive a fresh key for each VRC they obtain.

#### Issuer unlinkability (limited)

Introduce a public context:

    ctxt = "conference"

Issuer derives:

    pk_issuer_ctxt = PRF_sk(ipk || ctxt)

- Within a context → linkable  
- Across contexts → unlinkable  

This gives practical unlinkability across events or applications.

#### Receiver key derivation

After receiving the issuer’s context key:

    pk_VRC = PRF_sk'(pk_issuer_ctxt)

The receiver proves correct derivation in zero knowledge.

---

## Showing VRCs

Users can later prove statements about their collected VRCs.

Instead of handing over credentials directly, they produce a **zero-knowledge proof**.

<!-- Insert diagram here if desired -->
<!-- ![Showing proof](/assets/img/showing.png) -->

### Example

Alice wants to prove:

> Three different cryptographers vouched for me as a cryptographer.

She has VRCs:

    (vrc_i, ipk_i, att'_i, null_i, pk_i, pk'_i, st_i)
    for i in [3]

She proves:

- all VRCs are valid  
- all statements equal "Is a cryptographer"  
- issuer keys are distinct  
- receiver key corresponds to Alice  
- nullifiers are not revoked  

She sends a zero-knowledge proof Π and the issuer keys.  
The verifier checks the proof and decides whether to trust the issuers.

### Unlinkability considerations

Because receivers derive different keys per VRC:

- The proof must show all keys come from the same secret key  
  (not that they are identical).

Because issuer keys may depend on context:

- Distinct issuer keys may reflect different contexts rather than different issuers.
- Verifier logic must account for this.

---

## Defining the Security Requirements


## Summary

The protocol has three stages:

1. Personhood credential issuance  
2. Verifiable relationship credential issuance  
3. Showing VRCs via zero-knowledge proofs  

Unlinkability is achieved using PRF-derived keys and zero-knowledge proofs of correct derivation.  
This enables selective disclosure, revocation support, and privacy across interactions.

## References

[^1]: https://link.springer.com/chapter/10.1007/3-540-39200-9_18
