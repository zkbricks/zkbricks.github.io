---
layout: post
title: "A New Vision for Threshold Encryption"
date: 2026-01-28
permalink: /blogposts/threshold-encryption.html
description: "A new path to deployable threshold encryption: silent setup to eliminate DKG friction, and batched threshold encryption to keep decryption scalable."
nav_active: blog
authors:
  - Arka Rai Chaudhary
  - Sanjam Garg
---

Threshold encryption is a foundational primitive for building distributed systems that need confidentiality without relying on any single party. A sender encrypts a message to a *quorum* of $n$ users such that **any** set of $t$ users can decrypt the ciphertext, while **no** set of $t-1$ users can. Importantly, the ciphertext can be *succinct*: it does not grow with $n$ (or $t$).

As threshold encryption moves from theory into production—especially in systems like blockchains—two practical bottlenecks quickly become dominant:

1. **Setup friction (DKG “setup tax”).**  
   Traditionally, without assuming a trusted dealer, threshold encryption relies on a **distributed key generation (DKG)** protocol. A global secret key is generated jointly by the quorum, and each user learns a share. DKG works, but it comes with significant engineering and security headaches: multiple interactive rounds, complex failure modes, attribution of misbehavior, and challenges with churn and asynchrony. Just as importantly, DKG tends to *lock in* the quorum and threshold, making membership effectively static. In settings where the quorum should evolve dynamically, re-running DKG on every membership change becomes a recurring operational cost—the “setup tax” that makes threshold encryption hard to deploy at scale.

2. **Decryption scalability.**  
   Standard threshold decryption requires *per-ciphertext* collaboration: each committee member locally computes a **partial decryption**, and any $t$ partial decryptions can be combined to recover the plaintext. This is perfectly fine for a small number of ciphertexts, but it becomes a scaling bottleneck when the system needs to decrypt *many* ciphertexts, such as in blockchain **mempool privacy** where large batches of encrypted transactions may need to be opened together.

Based on a novel approach using witness encryption[^5], [^6], our team has been working on a new vision for threshold encryption that removes the setup tax *and* makes decryption scalable when many ciphertexts are involved. Two lines of work capture this direction: **silent setup** and **batched threshold encryption**.


## Silent Setup

*Silent setup*, introduced in our Crypto 2024 work[^1], replaces interactive setup with a _non-interactive_ procedure.

Instead of running a DKG, each user locally generates a public/secret key pair $(\mathsf{pk},\mathsf{sk})$ and publishes $\mathsf{pk}$. That is the entire setup. While each user's published public-key material grows with the maximum number of users supported, this cost is incurred only once.

This unlocks a much more flexible deployment model: a sender can choose the quorum and threshold **on the fly**, and derive an encryption key for that chosen quorum using only the published public keys of its members. Any $t$ members of the selected quorum can then collaborate to decrypt—preserving the threshold guarantee without the operational burden of DKG.


## Batched Threshold Encryption

In a second line of work[^2], we introduce **batched threshold encryption (BTE)**, designed to make threshold decryption scalable for large batches.

In the common case where a batch of $B$ ciphertexts is encrypted to the same quorum, BTE ensures that the size of each user’s partial decryption **does not depend on $B$**. This enables applications like an *encrypted mempool* in blockchains: users encrypt transactions under a quorum, and once a set of transactions is selected for inclusion in a block, a threshold of miners can collaboratively decrypt them by broadcasting partial decryptions. Crucially, those partial decryptions remain small—even when decrypting a large batch of transactions.

BTE has since seen improvements[^3], and a recent work[^4] obtains a BTE scheme that also supports silent setup—bringing these two threads of the new vision together.

## Working with us

We’re excited about what silent setup and batched threshold encryption make possible: threshold encryption that is substantially easier to deploy and continues to perform at the scales demanded by modern distributed systems.

If you’re interested in deploying silent setup, batched threshold encryption, or related threshold-encryption infrastructure in your application, we’d love to talk—whether you’re exploring early prototypes or preparing for production deployment.


---

*For more information [contact us](mailto:arka@zkbricks.com).*

### References

[^1]: Sanjam Garg, Dimitris Kolonelos, Guru-Vamsi Policharla, and Mingyuan Wang. *Threshold Encryption with Silent Setup.* Crypto 2024.
[^2]: Arka Rai Choudhuri, Sanjam Garg, Julien Piet, and Guru-Vamsi Policharla. *Mempool Transaction Privacy via Batched Threshold Encryption: Attacks and Defenses.* USENIX Security 2024.
[^3]: Arka Rai Choudhuri, Sanjam Garg, Guru-Vamsi Policharla, and Mingyuan Wang. *Practical Mempool Privacy via One-time Setup Batched Threshold Encryption.* USENIX Security 2025.
[^4]: Jan Bormet, Arka Rai Choudhuri, Sebastian Faust, Sanjam Garg, Hussien Othman, Guru-Vamsi Policharla, Ziyan Qu, and Mingyuan Wang. *BEAST-MEV: Batched Threshold Encryption with Silent Setup for MEV prevention.* Preprint.
[^5]: Sanjam Garg, Craig Gentry, Amit Sahai, Brent Waters. *Witness encryption and its applications.* STOC 2013.
[^6]: Sanjam Garg, Mohammad Hajiabadi, Dimitris Kolonelos, Abhiram Kothapalli, Guru-Vamsi Policharla. *A Framework for Witness Encryption from Linearly Verifiable SNARKs and Applications.* CRYPTO 2025: 504-539.
