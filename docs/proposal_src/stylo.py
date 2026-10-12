"""Rough stylometric profile: the signals most AI detectors lean on (uniform rhythm, stock phrasing)."""
import re, statistics as st, sys, collections

STOCK = ["taken together", "in addition", "therefore", "furthermore", "moreover", "this project proposes",
         "it is important", "in order to", "plays a crucial", "leverage", "robust", "comprehensive", "ensure",
         "seamless", "this body of work", "fundamentally", "rather than", "so that", "which is exactly",
         "in terms of", "a wide range", "not only", "as well as", "key", "crucial", "significant"]

def body(text):
    # drop title page, declaration, TOC and references
    start = text.find("1. Introduction"); end = text.find("10. References")
    t = text[start:end]
    t = re.sub(r"\n\s*\d+\s*\n", "\n", t)            # page numbers
    t = re.sub(r"\[\d+\]", "", t)
    return t

def sentences(t):
    t = re.sub(r"\s+", " ", t)
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z“\"(])", t)
    return [p.strip() for p in parts if len(p.split()) >= 3]

def profile(path):
    text = open(path, encoding="utf-8").read()
    t = body(text)
    sents = sentences(t)
    lens = [len(s.split()) for s in sents]
    words = re.findall(r"[a-zA-Z’']+", t.lower())
    ttr = len(set(words)) / len(words)
    # moving-average type-token ratio over 500-word windows (less length-sensitive)
    win = 500; mattr = st.mean(len(set(words[i:i+win]))/win for i in range(0, max(1, len(words)-win), 100))
    starts = collections.Counter(s.split()[0].lower() for s in sents)
    stock = {p: len(re.findall(r"\b" + re.escape(p) + r"\b", t.lower())) for p in STOCK}
    stock = {k: v for k, v in stock.items() if v}
    print(f"== {path}")
    print(f"words {len(words)}  sentences {len(sents)}  mean len {st.mean(lens):.1f}  sd {st.pstdev(lens):.1f}  burstiness(sd/mean) {st.pstdev(lens)/st.mean(lens):.2f}")
    print(f"shortest {min(lens)}  longest {max(lens)}  share of sentences 20-35 words {sum(20<=l<=35 for l in lens)/len(lens):.0%}")
    print(f"TTR {ttr:.3f}  MATTR(500) {mattr:.3f}")
    print("top sentence openers:", starts.most_common(6))
    print("stock phrases:", dict(sorted(stock.items(), key=lambda kv: -kv[1])))

for p in sys.argv[1:]:
    profile(p)
