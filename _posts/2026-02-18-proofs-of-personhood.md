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

The motivating question is simple: how does one prove their personhood online? Early systems like CAPTCHA[^1] were very influential in attempting to prove that the person was human, but modern ML systems have significantly weakened their security assumptions. More importantly, personhood is not only about proving "I am human." In many online settings, we also need to prove relationship-backed trust, reputation, or context-specific endorsements. Further, these need to be done respecting user privacy. 

It would seem that we already have the tools necessary to provide a cryptographic solution to this problem. In particular continues to be an incredible effort to make both digital credentials, and separately zero-knowledge (ZK) proofs, into systems that are not just practical, but have broad adoption. In light of this, it is natural to combine these tools in some form to prove properties about yourself, and relationships to others. However, an ad-hoc approach to building a solution might provide an incomplete solution at best, and a broken solution leaking privacy at worst. Further evaluating any propsed solution is also challenging because there e no formal security requirements. 



In our work, we initiate the study of a cryptographic framework for proofs of personhood. The contributions of our work include:
- Formalizing the security requirements of proofs of personhood. 
- Constructing proofs of personhood using existing cryptographic tools by identifying the exact properties required from the these tools.

In the paper we also present an efficient versions of the underlying tools to give an improved




In the rest of this blog, we will walk through a typical flow of the protocol, hi

## Personhood Credential Issuance

The first step is for a user to obtain a **personhood credential** from an issuer.  
Each issuer has a public key, and the user interacts with the issuer to obtain a credential on their attributes.

<!-- Insert diagram here if desired -->
<!-- ![Credential issuance](/assets/img/issuance.png) -->

### Example

Suppose the issuer is a university, **University of X**, with public key `ipk`.

Bob wants a credential on the following attributes:

<div class="jellyk-code-box">
<pre><code>att = {
  Name = Bob
  Occupation = Cryptographer
  Position = Professor
  Office phone = 123-4567
}</code></pre>
</div>

<div class="jellyk-highlight-box">
    <p><strong>Key idea.</strong> This is highlighted text across the full column width.</p>
  </div>


 <figure class="jellyk-figure"  style="max-width: 28rem; margin-left: auto; margin-right: auto;">
    <img src="/assets/images/test.png" alt="Describe image">
    <figcaption>Your caption (optional).</figcaption>
  </figure>

Bob:

- reveals a public key `pk`
- proves ownership of the corresponding secret key `sk`
- discloses attributes `att`

The issuer:

- verifies the attributes  
- generates a user-specific nullifier `null`  
- issues a credential on

    (att || null || pk)

Bob can verify the credential using `(ipk, att, null, pk)`.

### Unlinkability modification

If Bob always uses the same public key `pk`, colluding issuers could link his credentials.

To prevent this:

    pk_issuer = PRF_sk(ipk)

Bob proves in zero knowledge that this key was correctly derived from `sk`.

Now different issuers cannot link Bob’s credentials.

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