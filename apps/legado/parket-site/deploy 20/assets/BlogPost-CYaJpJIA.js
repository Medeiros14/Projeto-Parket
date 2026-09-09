import{e as T,u as M,r as a,j as e,m,d as I,f as W,F as O,L as q,a as H,S as V}from"./index-CstG8Lod.js";import{A as R}from"./arrow-left-BeD70yEx.js";import{f as $}from"./wpUtils-DGXA41Gi.js";import{p as U}from"./purify.es-Bc-0F0ao.js";/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Y=[["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M16 2v4",key:"4m81vk"}],["rect",{width:"18",height:"18",x:"3",y:"4",rx:"2",key:"1hopcy"}],["path",{d:"M3 10h18",key:"8toen8"}]],G=T("calendar",Y),g="text-[12px] uppercase tracking-[0.12em]",v={fontWeight:200},l={fontWeight:500},u={fontWeight:400};function J({size:t=20}){return e.jsx("svg",{width:t,height:t,viewBox:"0 0 24 24",fill:"none",children:e.jsx("path",{d:"M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",fill:"currentColor"})})}function K({title:t,subtitle:x,heroImage:n,category:f,readTime:y,publishDate:c,children:p,relatedArticles:d=[]}){const i=M(),[h,b]=a.useState(!1),[r,j]=a.useState(!1),[w,A]=a.useState(!1);return a.useEffect(()=>{window.scrollTo(0,0)},[]),a.useEffect(()=>{const s=()=>{j(window.scrollY>60),A(window.scrollY>800)};return window.addEventListener("scroll",s),()=>window.removeEventListener("scroll",s)},[]),e.jsxs("div",{className:"w-full min-h-screen bg-[#FAF8F5] relative",style:{fontFamily:"'DM Sans', sans-serif"},children:[e.jsx("header",{className:`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${r?"bg-[#FAF8F5]/95 backdrop-blur-sm border-b border-[#2A2A2A]/10":"bg-transparent"}`,children:e.jsxs("div",{className:"max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20 flex items-center justify-between h-20",children:[e.jsx("button",{onClick:()=>i("/"),className:"relative z-10",children:e.jsx("img",{src:"/Logo.png",alt:"Parket",className:`h-[40px] md:h-[50px] transition-all duration-500 ${r?"brightness-0":"brightness-100"}`})}),e.jsxs("button",{onClick:()=>i("/"),className:`flex items-center gap-2 ${g} transition-colors duration-300 hover:opacity-70 ${r?"text-[#2A2A2A]":"text-[#E8E4DF]"}`,style:l,children:[e.jsx(R,{size:16})," ",e.jsx("span",{className:"hidden sm:inline",children:"Voltar ao Início"})]})]})}),e.jsxs("section",{className:"relative h-[60vh] md:h-[75vh] w-full overflow-hidden",children:[e.jsx("img",{src:n,alt:t,fetchPriority:"high",decoding:"async",className:"w-full h-full object-cover",style:{objectPosition:"center 75%"}}),e.jsx("div",{className:"absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/70"}),e.jsx("div",{className:"absolute inset-0 z-10 flex flex-col justify-end pb-12 md:pb-20 px-6 md:px-10 lg:px-20 max-w-[1280px] mx-auto left-0 right-0",children:e.jsxs(m.div,{initial:{opacity:0,y:30},animate:{opacity:1,y:0},transition:{duration:.8,ease:[.25,.1,.25,1]},children:[e.jsxs("div",{className:"flex items-center gap-4 mb-5",children:[e.jsx("span",{className:`text-[#9C8B6E] ${g}`,style:l,children:f}),e.jsx("span",{className:"text-[#E8E4DF]/30",children:"|"}),e.jsxs("span",{className:"flex items-center gap-1.5 text-[#E8E4DF]/50 text-[12px]",style:u,children:[e.jsx(I,{size:12})," ",y]}),e.jsx("span",{className:"text-[#E8E4DF]/30",children:"|"}),e.jsxs("span",{className:"flex items-center gap-1.5 text-[#E8E4DF]/50 text-[12px]",style:u,children:[e.jsx(G,{size:12})," ",c]})]}),e.jsx("h1",{className:"text-[#E8E4DF] text-[28px] md:text-[42px] lg:text-[56px] leading-[1.1] max-w-[900px] tracking-[0.02em]",style:v,children:t}),x&&e.jsx("p",{className:"text-[#E8E4DF]/60 text-[16px] md:text-[18px] leading-[1.6] mt-5 max-w-[640px]",style:u,children:x})]})})]}),e.jsx("article",{className:"bg-[#FAF8F5] py-16 md:py-24",children:e.jsx("div",{className:"max-w-[780px] mx-auto px-8 sm:px-12 md:px-10",children:e.jsx(m.div,{initial:{opacity:0,y:20},animate:{opacity:1,y:0},transition:{duration:.6,delay:.2},className:"article-content",children:p})})}),e.jsx("section",{className:"bg-[#1A1A1A] py-20 md:py-28",children:e.jsx("div",{className:"max-w-[780px] mx-auto px-6 md:px-10 text-center",children:e.jsxs(m.div,{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},transition:{duration:.6},children:[e.jsx("p",{className:`text-[#9C8B6E] ${g} mb-5`,style:l,children:"Fale com um especialista"}),e.jsxs("h2",{className:"text-[#E8E4DF] text-[24px] md:text-[32px] lg:text-[40px] leading-[1.15] tracking-[0.02em] mb-5",style:v,children:["Precisa de orientação técnica",e.jsx("br",{className:"hidden md:block"}),"para o seu projeto?"]}),e.jsx("p",{className:"text-[#8C8478] text-[15px] leading-[1.7] max-w-[480px] mx-auto mb-8",style:u,children:"A equipe Parket está pronta para ajudar na especificação, orçamento e execução do seu projeto em madeira."}),e.jsxs("a",{href:"https://wa.me/5511999600222",target:"_blank",rel:"noopener noreferrer",className:"border border-[#E8E4DF] text-[#E8E4DF] px-10 py-4 text-[13px] uppercase tracking-[0.08em] hover:bg-[#E8E4DF] hover:text-[#0D0D0D] transition-all duration-500 inline-flex items-center gap-3",style:l,children:[e.jsx(J,{size:18})," Falar com Especialista"]})]})})}),d.length>0&&e.jsx("section",{className:"bg-[#FAF8F5] py-16 md:py-24 border-t border-[#2A2A2A]/5",children:e.jsxs("div",{className:"max-w-[1280px] mx-auto px-6 md:px-10 lg:px-20",children:[e.jsx("p",{className:`text-[#9C8B6E] ${g} mb-4`,style:l,children:"Continue lendo"}),e.jsx("h3",{className:"text-[#2A2A2A] text-[24px] md:text-[32px] leading-[1.15] tracking-[0.02em] mb-10",style:v,children:"Artigos relacionados"}),e.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6",children:d.map(s=>e.jsxs("button",{onClick:()=>i(`/blog/${s.slug}`),className:"group text-left",children:[e.jsx("div",{className:"aspect-[16/10] overflow-hidden mb-4",children:e.jsx("img",{src:s.image,alt:s.title,loading:"lazy",decoding:"async",className:"w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"})}),e.jsx("span",{className:"text-[#9C8B6E] text-[11px] uppercase tracking-[0.08em]",style:l,children:s.category}),e.jsx("h4",{className:"text-[#2A2A2A] text-[16px] leading-[1.35] mt-2 group-hover:text-[#9C8B6E] transition-colors duration-300",style:{fontWeight:500},children:s.title})]},s.slug))})]})}),w&&e.jsx(m.button,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},onClick:()=>window.scrollTo({top:0,behavior:"smooth"}),className:"fixed bottom-24 right-6 z-40 w-11 h-11 bg-[#2A2A2A] text-[#E8E4DF] flex items-center justify-center hover:bg-[#9C8B6E] transition-colors duration-300",children:e.jsx(W,{size:18})}),e.jsx(O,{}),e.jsx(q,{open:h,onClose:()=>b(!1)})]})}function te(){var N,E,F,k,C,z,B,D,S,L,P;const{slug:t}=H(),x=M(),[n,f]=a.useState(null),[y,c]=a.useState(!0),[p,d]=a.useState(null);if(a.useEffect(()=>{t&&(c(!0),fetch(`https://parket.com.br/wp-json/wp/v2/posts?slug=${t}&_embed`).then(o=>o.json()).then(o=>{o&&o.length>0?f(o[0]):d("Post não encontrado"),c(!1)}).catch(o=>{console.error("Error fetching post:",o),d("Erro ao carregar o post"),c(!1)}))},[t]),y)return e.jsx("div",{className:"min-h-screen bg-[#FAF8F5] flex items-center justify-center",children:e.jsx(m.div,{animate:{opacity:[.3,.6,.3]},transition:{duration:1.5,repeat:1/0},className:"text-[#9C8B6E] uppercase tracking-widest text-[12px] font-medium",children:"Carregando artigo..."})});if(p||!n)return e.jsxs("div",{className:"min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center px-6 text-center",children:[e.jsx("h1",{className:"text-[24px] font-light text-[#2A2A2A] mb-4",children:p||"Post não encontrado"}),e.jsx("button",{onClick:()=>x("/blog"),className:"text-[#9C8B6E] uppercase tracking-widest text-[12px] font-medium hover:text-[#2A2A2A] transition-colors",children:"Voltar ao Blog"})]});const i=((N=n.title)==null?void 0:N.rendered)||"",h=$(((E=n.content)==null?void 0:E.rendered)||""),b=((k=(F=n.excerpt)==null?void 0:F.rendered)==null?void 0:k.replace(/<[^>]*>?/gm,"").slice(0,160))||"",r=$(((B=(z=(C=n._embedded)==null?void 0:C["wp:featuredmedia"])==null?void 0:z[0])==null?void 0:B.source_url)||"https://parket.com.br/wp-content/uploads/2026/03/grandiosos.jpg"),j=((P=(L=(S=(D=n._embedded)==null?void 0:D["wp:term"])==null?void 0:S[0])==null?void 0:L[0])==null?void 0:P.name)||"Blog",w=h.split(/\s+/).length,A=Math.max(1,Math.ceil(w/200))+" min de leitura",_=new Date(n.date).toLocaleDateString("pt-BR",{day:"2-digit",month:"short",year:"numeric"}).replace(".","");return e.jsxs(e.Fragment,{children:[e.jsx(V,{title:`${i} | Parket Blog`,description:b,url:`https://parket.com.br/blog/${t}`,image:r}),e.jsxs(K,{title:i,subtitle:"",heroImage:r,category:j,readTime:A,publishDate:_,relatedArticles:[],children:[e.jsx("div",{className:"wp-content-styles",dangerouslySetInnerHTML:{__html:U.sanitize(h)}}),e.jsx("style",{children:`
          .wp-content-styles p {
            color: #4A4A4A;
            font-size: 16px;
            line-height: 1.75;
            margin-bottom: 1.5rem;
            font-weight: 400;
          }
          @media (min-width: 768px) {
            .wp-content-styles p {
              font-size: 17px;
            }
          }
          .wp-content-styles h2 {
            color: #2A2A2A;
            font-size: 24px;
            line-height: 1.2;
            letter-spacing: 0.02em;
            margin-top: 3.5rem;
            margin-bottom: 1.5rem;
            font-weight: 200;
          }
          @media (min-width: 768px) {
            .wp-content-styles h2 {
              font-size: 30px;
            }
          }
          .wp-content-styles h3 {
            color: #2A2A2A;
            font-size: 20px;
            line-height: 1.25;
            letter-spacing: 0.02em;
            margin-top: 2.5rem;
            margin-bottom: 1rem;
            font-weight: 300;
          }
          @media (min-width: 768px) {
            .wp-content-styles h3 {
              font-size: 22px;
            }
          }
          .wp-content-styles img {
            width: 100%;
            height: auto;
            margin: 2.5rem 0;
            display: block;
          }
          .wp-content-styles ul, .wp-content-styles ol {
            margin-bottom: 1.5rem;
            padding-left: 1rem;
          }
          .wp-content-styles li {
            color: #4A4A4A;
            font-size: 16px;
            line-height: 1.65;
            margin-bottom: 0.75rem;
            position: relative;
            list-style: none;
            padding-left: 1.5rem;
          }
          .wp-content-styles li::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0.6em;
            width: 6px;
            height: 6px;
            background-color: #9C8B6E;
          }
          .wp-content-styles blockquote {
            border-left: 2px solid #9C8B6E;
            padding-left: 1.5rem;
            margin: 2rem 0;
            font-style: italic;
            color: #2A2A2A;
            font-size: 18px;
            font-weight: 300;
          }
          @media (min-width: 768px) {
            .wp-content-styles blockquote {
              font-size: 20px;
            }
          }
          .wp-content-styles hr {
            border: 0;
            border-top: 1px solid rgba(42, 42, 42, 0.1);
            margin: 2.5rem 0;
          }
        `})]})]})}export{te as BlogPost,te as default};
