import sys, warnings, numpy as np, pandas as pd
warnings.simplefilter("ignore")
from sklearn.ensemble import HistGradientBoostingClassifier as HGC, HistGradientBoostingRegressor as HGR
from sklearn.metrics import accuracy_score, brier_score_loss, log_loss, roc_auc_score, mean_absolute_error, mean_squared_error
D=sys.argv[1]
df=pd.read_csv(D+"/Matches.csv",parse_dates=["MatchDate"])
stale=['ARG','BRA','CHN','DEN','FIN','IRL','JAP','MEX','NOR','POL','ROM','RUS','SUI','SWE','USA','AUT']
df=df.dropna(subset=['FTResult']); df=df[~df.Division.isin(stale)].dropna(subset=['MatchDate'])
print("rows",len(df),df.MatchDate.min().date(),df.MatchDate.max().date())
df['EloDiff']=df.HomeElo-df.AwayElo; df['FormDiff3']=df.Form3Home-df.Form3Away; df['FormDiff5']=df.Form5Home-df.Form5Away
for k,c in (('Home','OddHome'),('Draw','OddDraw'),('Away','OddAway')): df['ImpProb'+k]=1/df[c]
df['OddsMargin']=df.ImpProbHome+df.ImpProbDraw+df.ImpProbAway-1
df['Month']=df.MatchDate.dt.month; df['Division_enc']=df.Division.astype('category').cat.codes
F=["Division_enc","Month","HomeElo","AwayElo","EloDiff","Form3Home","Form5Home","Form3Away","Form5Away","FormDiff3","FormDiff5","OddHome","OddDraw","OddAway","ImpProbHome","ImpProbDraw","ImpProbAway","OddsMargin"]
df['Year']=df.MatchDate.dt.year
tr=df[df.Year<=2024]; te=df[df.Year>=2025]
print("train",len(tr),"test",len(te))
print("test rows with real Elo: %.1f%%, real odds: %.1f%%"%(te.HomeElo.notna().mean()*100, te.OddHome.notna().mean()*100))
# leak-free imputation: train medians only
med=tr[F].median(); Xtr=tr[F].fillna(med); Xte=te[F].fillna(med)
# favourite target
def fav(d):
    h=(d.ImpProbHome>=d.ImpProbAway).values
    return h, np.where(h,d.FTResult.isin(['H','D']),d.FTResult.isin(['A','D'])).astype(int)
_,ytr=fav(tr); hte,yte=fav(te)
clf=HGC(max_iter=150,max_leaf_nodes=31,learning_rate=0.08,random_state=42).fit(Xtr,ytr)
p=clf.predict_proba(Xte)[:,1]
print("\n== Favourite avoids defeat ==")
print("base rate (always 'succeeds'): %.4f"%yte.mean())
print("model acc %.4f | AUC %.4f | Brier %.4f (const %.4f) | logloss %.4f"%(accuracy_score(yte,p>=.5),roc_auc_score(yte,p),brier_score_loss(yte,p),brier_score_loss(yte,np.full(len(yte),ytr.mean())),log_loss(yte,p)))
# odds-only baseline for same target: P(fav not lose)=1-implied prob of fav losing
imp=te[['ImpProbHome','ImpProbDraw','ImpProbAway']].fillna(1/3).values; imp=imp/imp.sum(1,keepdims=True)
pb=np.where(hte,1-imp[:,2],1-imp[:,0])
print("bookmaker-implied AUC %.4f Brier %.4f"%(roc_auc_score(yte,pb),brier_score_loss(yte,pb)))
for t in (.8,.85):
    m=p>=t; print(f"p>={t}: n={m.sum()} acc={yte[m].mean():.4f}  (precision on 'fails' class: pred never <0.5 -> {(p[m]<.5).sum()} predicted fails)")
print("calibration (p bin -> actual rate):")
b=pd.cut(p,[0,.5,.6,.7,.8,.9,1]); print(pd.DataFrame({'p':p,'y':yte}).groupby(b).agg(n=('y','size'),mean_p=('p','mean'),actual=('y','mean')).round(3))
# 3-class 1X2 vs bookmaker
m3={'H':2,'D':1,'A':0}; y3tr=tr.FTResult.map(m3).values; y3te=te.FTResult.map(m3).values
c3=HGC(max_iter=150,learning_rate=0.05,max_leaf_nodes=15,random_state=42).fit(Xtr,y3tr)
P3=c3.predict_proba(Xte)
ok=te.OddHome.notna().values
bk=imp[:,[2,1,0]]  # order A,D,H -> classes 0,1,2
print("\n== 1X2 (test rows with real odds, n=%d) =="%ok.sum())
print("HGB 3-class  acc %.4f logloss %.4f"%(accuracy_score(y3te[ok],P3[ok].argmax(1)),log_loss(y3te[ok],P3[ok])))
print("Bookmaker    acc %.4f logloss %.4f"%(accuracy_score(y3te[ok],bk[ok].argmax(1)),log_loss(y3te[ok],bk[ok])))
print("Always home  acc %.4f"%((y3te==2).mean()))
# goals
print("\n== Goals ==")
for col,nm in (('FTHome','home'),('FTAway','away')):
    r=HGR(max_iter=120,max_leaf_nodes=31,random_state=42).fit(Xtr,tr[col]); pr=r.predict(Xte); y=te[col].values
    print(nm,"MAE %.3f RMSE %.3f | mean-baseline MAE %.3f RMSE %.3f"%(mean_absolute_error(y,pr),mean_squared_error(y,pr)**.5,mean_absolute_error(y,np.full(len(y),tr[col].mean())),mean_squared_error(y,np.full(len(y),tr[col].mean()))**.5))
