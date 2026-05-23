export const NOISE_GLSL = `
vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289v3(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

export const NODE_VERTEX = `${NOISE_GLSL}
attribute float nodeSize;
attribute float nodeType;
attribute vec3 nodeColor;
attribute float distanceFromRoot;
uniform float uTime;
uniform vec3 uPulsePositions[3];
uniform float uPulseTimes[3];
uniform float uPulseSpeed;
uniform float uBaseNodeSize;
varying vec3 vColor;
varying float vNodeType;
varying vec3 vPosition;
varying float vPulseIntensity;
varying float vDistanceFromRoot;
varying float vGlow;
float getPulse(vec3 wp,vec3 pp,float pt){
  if(pt<0.)return 0.;
  float t=uTime-pt;
  if(t<0.||t>4.)return 0.;
  float r=t*uPulseSpeed;
  return smoothstep(3.,0.,abs(distance(wp,pp)-r))*smoothstep(4.,0.,t);
}
void main(){
  vNodeType=nodeType;vColor=nodeColor;vDistanceFromRoot=distanceFromRoot;
  vec3 wp=(modelMatrix*vec4(position,1.)).xyz;vPosition=wp;
  float pi=0.;
  for(int i=0;i<3;i++) pi+=getPulse(wp,uPulsePositions[i],uPulseTimes[i]);
  vPulseIntensity=min(pi,1.);
  float breathe=sin(uTime*.7+distanceFromRoot*.15)*.15+.85;
  float sz=nodeSize*breathe*(1.+vPulseIntensity*2.5);
  vGlow=.5+.5*sin(uTime*.5+distanceFromRoot*.2);
  vec3 pos=position;
  if(nodeType>.5) pos+=normal*snoise(position*.08+uTime*.08)*.15;
  vec4 mv=modelViewMatrix*vec4(pos,1.);
  gl_PointSize=sz*uBaseNodeSize*(1000./-mv.z);
  gl_Position=projectionMatrix*mv;
}`;

export const NODE_FRAGMENT = `
uniform float uTime;
uniform vec3 uPulseColors[3];
varying vec3 vColor;
varying float vNodeType;
varying vec3 vPosition;
varying float vPulseIntensity;
varying float vDistanceFromRoot;
varying float vGlow;
void main(){
  vec2 c=2.*gl_PointCoord-1.;float d=length(c);
  if(d>1.) discard;
  float g1=1.-smoothstep(0.,.5,d);float g2=1.-smoothstep(0.,1.,d);
  float gs=pow(g1,1.2)+g2*.3;
  vec3 col=vColor*(0.9+0.1*sin(uTime*.6+vDistanceFromRoot*.25));
  if(vPulseIntensity>0.){
    col=mix(col,mix(vec3(1.),uPulseColors[0],.4),vPulseIntensity*.8);
    col*=(1.+vPulseIntensity*1.2);gs*=(1.+vPulseIntensity);
  }
  col+=vec3(1.)*smoothstep(.4,0.,d)*.3;
  float alpha=gs*(.95-.3*d);
  alpha*=smoothstep(100.,15.,length(vPosition-cameraPosition));
  gl_FragColor=vec4(col*(1.+vGlow*.1),alpha);
}`;

export const CONN_VERTEX = `${NOISE_GLSL}
attribute vec3 startPoint;
attribute vec3 endPoint;
attribute float connectionStrength;
attribute float pathIndex;
attribute vec3 connectionColor;
uniform float uTime;
uniform vec3 uPulsePositions[3];
uniform float uPulseTimes[3];
uniform float uPulseSpeed;
varying vec3 vColor;
varying float vConnectionStrength;
varying float vPulseIntensity;
varying float vPathPosition;
varying float vDistanceFromCamera;
float getPulse(vec3 wp,vec3 pp,float pt){
  if(pt<0.)return 0.;
  float t=uTime-pt;
  if(t<0.||t>4.)return 0.;
  return smoothstep(3.,0.,abs(distance(wp,pp)-t*uPulseSpeed))*smoothstep(4.,0.,t);
}
void main(){
  float t=position.x;vPathPosition=t;
  vec3 mid=mix(startPoint,endPoint,.5);
  vec3 perp=normalize(cross(normalize(endPoint-startPoint),vec3(0.,1.,0.)));
  if(length(perp)<.1) perp=vec3(1.,0.,0.);
  mid+=perp*sin(t*3.14159)*.15;
  vec3 fp=mix(mix(startPoint,mid,t),mix(mid,endPoint,t),t);
  fp+=perp*snoise(vec3(pathIndex*.08,t*.6,uTime*.15))*.12;
  vec3 wp=(modelMatrix*vec4(fp,1.)).xyz;
  float pi=0.;
  for(int i=0;i<3;i++) pi+=getPulse(wp,uPulsePositions[i],uPulseTimes[i]);
  vPulseIntensity=min(pi,1.);
  vColor=connectionColor;vConnectionStrength=connectionStrength;
  vDistanceFromCamera=length(wp-cameraPosition);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(fp,1.);
}`;

export const CONN_FRAGMENT = `
uniform float uTime;
uniform vec3 uPulseColors[3];
varying vec3 vColor;
varying float vConnectionStrength;
varying float vPulseIntensity;
varying float vPathPosition;
varying float vDistanceFromCamera;
void main(){
  float f1=sin(vPathPosition*25.-uTime*4.)*.5+.5;
  float f2=sin(vPathPosition*15.-uTime*2.5+1.57)*.5+.5;
  float flow=(f1+f2*.5)/1.5;
  vec3 col=vColor*(.8+.2*sin(uTime*.6+vPathPosition*12.));
  if(vPulseIntensity>0.){
    col=mix(col,mix(vec3(1.),uPulseColors[0],.3)*1.2,vPulseIntensity*.7);
  }
  col*=(.7+flow*.4*vConnectionStrength+vConnectionStrength*.5);
  float alpha=.7*vConnectionStrength+flow*.3;
  alpha=mix(alpha,min(1.,alpha*2.5),vPulseIntensity);
  alpha*=smoothstep(100.,15.,vDistanceFromCamera);
  gl_FragColor=vec4(col,alpha);
}`;

export const STAR_VERTEX = `
attribute float size;
attribute vec3 color;
varying vec3 vColor;
uniform float uTime;
void main(){
  vColor=color;
  vec4 mv=modelViewMatrix*vec4(position,1.);
  float t=sin(uTime*2.+position.x*100.)*.3+.7;
  gl_PointSize=size*t*(300./-mv.z);
  gl_Position=projectionMatrix*mv;
}`;

export const STAR_FRAGMENT = `
varying vec3 vColor;
void main(){
  vec2 c=gl_PointCoord-.5;float d=length(c);
  if(d>.5) discard;
  gl_FragColor=vec4(vColor,(1.-smoothstep(0.,.5,d))*.8);
}`;
