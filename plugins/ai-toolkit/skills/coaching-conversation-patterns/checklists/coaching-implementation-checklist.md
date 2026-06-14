# Coaching Implementation Checklist

## Table of Contents

- [Pre-Development](#pre-development)
- [Safety Implementation](#safety-implementation)
  - [Crisis Detection (CRITICAL)](#crisis-detection-critical)
  - [Medical Advice Prevention](#medical-advice-prevention)
  - [Response Validation](#response-validation)
- [Empathy & Tone](#empathy--tone)
- [Conversation State](#conversation-state)
- [Coaching Methodologies](#coaching-methodologies)
- [RAG Integration](#rag-integration)
- [Response Generation](#response-generation)
- [Evaluation & Monitoring](#evaluation--monitoring)
- [Testing](#testing)
- [Production Readiness](#production-readiness)
- [Sign-Off](#sign-off)

Use this checklist to validate your AI health coaching implementation before production deployment.

---

## Pre-Development

- [ ] **Requirements Defined**
  - [ ] Target user personas identified
  - [ ] Coaching scope and boundaries documented
  - [ ] Success metrics defined (engagement, satisfaction, outcomes)
  - [ ] Human escalation paths established

- [ ] **Compliance Review**
  - [ ] HIPAA compliance requirements understood
  - [ ] Data handling policies defined
  - [ ] PHI logging restrictions documented
  - [ ] Consent mechanisms designed

---

## Safety Implementation

### Crisis Detection (CRITICAL)

- [ ] **Immediate Crisis Detection**
  - [ ] Suicidal ideation patterns detected
  - [ ] Self-harm mentions flagged
  - [ ] Overdose references caught
  - [ ] Testing: All crisis test cases pass

- [ ] **Crisis Response**
  - [ ] Pre-approved crisis response message
  - [ ] 988 and Crisis Text Line included
  - [ ] Human coach notification triggered
  - [ ] Crisis event logging (HIPAA-compliant)

- [ ] **Escalation Path**
  - [ ] Immediate: < 1 minute notification
  - [ ] Urgent: Same-day review scheduled
  - [ ] Concerning: Flagged for next review

### Medical Advice Prevention

- [ ] **Detection Implemented**
  - [ ] Diagnosis-seeking patterns detected
  - [ ] Medication questions flagged
  - [ ] Treatment requests caught
  - [ ] Symptom interpretation blocked

- [ ] **Redirect Responses**
  - [ ] Empathetic redirect for diagnosis questions
  - [ ] Clear redirect for medication questions
  - [ ] Healthcare provider referral included
  - [ ] Offer to help in appropriate ways

### Response Validation

- [ ] **Pre-Send Safety Check**
  - [ ] Medical advice detection (LLM)
  - [ ] Harmful suggestion detection
  - [ ] Dismissive language check
  - [ ] Over-promising detection

- [ ] **Quality Gate**
  - [ ] Safety score = 10/10 required
  - [ ] Empathy score ≥ 7/10 required
  - [ ] Failed responses regenerated or blocked

---

## Empathy & Tone

- [ ] **Sentiment Detection**
  - [ ] Discouraged sentiment detected
  - [ ] Motivated sentiment detected
  - [ ] Anxious sentiment detected
  - [ ] Frustrated sentiment detected
  - [ ] Celebratory sentiment detected

- [ ] **Tone Calibration**
  - [ ] Warm tone for discouraged members
  - [ ] Energetic tone for motivated members
  - [ ] Calm tone for anxious members
  - [ ] Understanding tone for frustrated members
  - [ ] Matching energy for celebrations

- [ ] **EARS Framework**
  - [ ] Empathize: Feelings acknowledged
  - [ ] Affirm: Experience validated
  - [ ] Reflect: Understanding mirrored
  - [ ] Support: Next step offered

- [ ] **Language Quality**
  - [ ] No dismissive phrases ("at least", "just")
  - [ ] No toxic positivity ("stay positive!")
  - [ ] Member's name used appropriately
  - [ ] Warm, supportive language throughout

---

## Conversation State

- [ ] **State Schema Implemented**
  - [ ] Session ID tracking
  - [ ] Turn history maintained
  - [ ] Sentiment trajectory tracked
  - [ ] Commitments recorded
  - [ ] Safety flags persisted

- [ ] **Context Management**
  - [ ] Short-term: Last 5-10 turns included
  - [ ] Medium-term: Session context summarized
  - [ ] Long-term: RAG retrieval working
  - [ ] Token budget respected

- [ ] **State Persistence**
  - [ ] Database schema created
  - [ ] State recovery implemented
  - [ ] Session resumption works
  - [ ] Cross-session context available

- [ ] **Summarization**
  - [ ] Mid-session summaries generated
  - [ ] End-of-session summaries saved
  - [ ] Summaries include key commitments
  - [ ] Summaries support next session

---

## Coaching Methodologies

- [ ] **Motivational Interviewing**
  - [ ] Open-ended questions used
  - [ ] Affirmations given appropriately
  - [ ] Reflections demonstrate understanding
  - [ ] Summaries consolidate discussions

- [ ] **Goal Setting**
  - [ ] SMART framework applied
  - [ ] Goals are specific
  - [ ] Progress is measurable
  - [ ] Barriers discussed
  - [ ] Timelines established

- [ ] **Behavioral Change**
  - [ ] Implementation intentions supported
  - [ ] Habit stacking suggested when appropriate
  - [ ] Environment design considered
  - [ ] Progress celebrated

---

## RAG Integration

- [ ] **Context Retrieval**
  - [ ] Member profile retrieved
  - [ ] Past conversations searchable
  - [ ] Goal progress included
  - [ ] Relevant guidelines found

- [ ] **Personalization**
  - [ ] Member's name used
  - [ ] Goals referenced
  - [ ] Past progress mentioned
  - [ ] Communication style matched

- [ ] **Context Sufficiency**
  - [ ] Sufficiency check implemented
  - [ ] Abstention when context insufficient
  - [ ] No hallucination of member history

---

## Response Generation

- [ ] **System Prompt**
  - [ ] Coaching persona defined
  - [ ] Boundaries clearly stated
  - [ ] Example interactions included
  - [ ] Versioned and tracked

- [ ] **Response Quality**
  - [ ] Concise (2-4 paragraphs)
  - [ ] Structured (empathy → point → support)
  - [ ] Action-oriented when appropriate
  - [ ] Ends with invitation to continue

- [ ] **Streaming (if applicable)**
  - [ ] First token < 500ms
  - [ ] Smooth delivery
  - [ ] Error handling implemented

---

## Evaluation & Monitoring

- [ ] **Quality Metrics**
  - [ ] Empathy score tracked
  - [ ] Safety score tracked
  - [ ] Relevance score tracked
  - [ ] Actionability score tracked

- [ ] **Automated Evaluation**
  - [ ] LLM-as-judge implemented
  - [ ] Batch evaluation capability
  - [ ] Threshold alerts configured

- [ ] **Golden Dataset**
  - [ ] 50+ validated conversations
  - [ ] Crisis handling test cases
  - [ ] Medical redirect test cases
  - [ ] Edge case coverage

- [ ] **Observability**
  - [ ] Conversation tracing (Langfuse or similar)
  - [ ] Error logging
  - [ ] Cost tracking
  - [ ] Latency monitoring

---

## Testing

- [ ] **Unit Tests**
  - [ ] Crisis detection functions
  - [ ] Medical advice detection
  - [ ] Sentiment detection
  - [ ] State management

- [ ] **Integration Tests**
  - [ ] Full conversation flow
  - [ ] RAG retrieval
  - [ ] Database persistence
  - [ ] Human escalation

- [ ] **Safety Tests**
  - [ ] All crisis patterns trigger correctly
  - [ ] Medical advice blocked
  - [ ] No harmful suggestions generated
  - [ ] Escalation notifications sent

- [ ] **Quality Tests**
  - [ ] Empathy scores meet threshold
  - [ ] Response times acceptable
  - [ ] Personalization working
  - [ ] Context maintained across turns

---

## Production Readiness

- [ ] **Human Oversight**
  - [ ] Coach review queue implemented
  - [ ] Escalation notifications working
  - [ ] Quality sampling process defined
  - [ ] Feedback mechanism available

- [ ] **Fallback Handling**
  - [ ] LLM errors handled gracefully
  - [ ] Fallback to human coach available
  - [ ] Member notified of technical issues
  - [ ] Retry logic implemented

- [ ] **Compliance**
  - [ ] No PHI in logs
  - [ ] Consent tracked
  - [ ] Data retention policies applied
  - [ ] Audit trail maintained

- [ ] **Documentation**
  - [ ] System prompt versioned
  - [ ] Safety rules documented
  - [ ] Escalation process documented
  - [ ] Team trained on monitoring

---

## Sign-Off

| Check | Owner | Date | Notes |
|-------|-------|------|-------|
| Safety Implementation | | | |
| Empathy & Tone | | | |
| State Management | | | |
| RAG Integration | | | |
| Testing Complete | | | |
| Compliance Review | | | |
| Production Ready | | | |

---

**Remember**: This checklist represents minimum requirements. When in doubt, add more safety measures. People's wellbeing depends on getting this right.
