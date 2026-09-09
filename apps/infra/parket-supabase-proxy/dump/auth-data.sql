--
-- PostgreSQL database dump
--

\restrict wgGMsHWyLoetyf1HPU0jbo4wgg3fhNWrAaiRbhMxPHsTEeVCrZ8gDDjk0oyilCr

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE auth.audit_log_entries DISABLE TRIGGER ALL;

COPY auth.audit_log_entries (instance_id, id, payload, created_at, ip_address) FROM stdin;
\.


ALTER TABLE auth.audit_log_entries ENABLE TRIGGER ALL;

--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.custom_oauth_providers DISABLE TRIGGER ALL;

COPY auth.custom_oauth_providers (id, provider_type, identifier, name, client_id, client_secret, acceptable_client_ids, scopes, pkce_enabled, attribute_mapping, authorization_params, enabled, email_optional, issuer, discovery_url, skip_nonce_check, cached_discovery, discovery_cached_at, authorization_url, token_url, userinfo_url, jwks_uri, created_at, updated_at) FROM stdin;
\.


ALTER TABLE auth.custom_oauth_providers ENABLE TRIGGER ALL;

--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state DISABLE TRIGGER ALL;

COPY auth.flow_state (id, user_id, auth_code, code_challenge_method, code_challenge, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at, invite_token, referrer, oauth_client_state_id, linking_target_id, email_optional) FROM stdin;
\.


ALTER TABLE auth.flow_state ENABLE TRIGGER ALL;

--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.users DISABLE TRIGGER ALL;

COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;
00000000-0000-0000-0000-000000000000	cc185abf-3b26-4258-b742-266901e5e921	authenticated	authenticated	comercial10@parket.com.br	$2a$10$bI5A8BGsg3KwFEze/fObOuJRRk5quOVD/1iiMHosI0vvGTxXtUNGS	2026-03-11 20:11:08.804021+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "viewer", "full_name": "Sueli Jorge ", "email_verified": true, "dept_permissions": {"comercial": "view"}}	\N	2026-03-11 20:11:08.801435+00	2026-03-11 20:11:08.804669+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	c59939ea-e086-4e8d-9b36-bda2dd39bb4d	authenticated	authenticated	comercial7@parket.com.br	$2a$10$Qef1THg/6LK3leTY7q/p2urrh7Z2IR2.jVazzhoBL/LJpnU8jVyc2	2026-03-11 20:10:25.115379+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "JOYCE SILVA DE JESUS", "email_verified": true, "dept_permissions": {"comercial": "view"}}	\N	2026-03-11 20:10:25.112493+00	2026-03-11 20:10:25.116056+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	00c01c83-69c3-4be5-81f4-0ac4ef19faa1	authenticated	authenticated	comercial5@parket.com.br	$2a$10$KWFSx6tiB4Hpjo1/EoQW.uvQgKFqXf8SG41PWu9T8.R7lUUDXGQA2	2026-03-11 20:09:47.526731+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Felipe Lessa ", "email_verified": true, "dept_permissions": {"comercial": "view"}}	\N	2026-03-11 20:09:47.52439+00	2026-03-11 20:09:47.527833+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	24ec4b5b-f538-49ed-ad33-1b97c8d2ede6	authenticated	authenticated	comercial3@parket.com.br	$2a$10$uJC/OhwYxNIUhsBAIlYe6OFRfArbkgM45B1soh9d9I0YdBXKoyRkW	2026-03-11 20:07:49.056832+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "viewer", "full_name": "Davi Alves", "email_verified": true, "dept_permissions": {"comercial": "view"}}	\N	2026-03-11 20:07:49.054079+00	2026-03-11 20:07:49.057552+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	c0bac305-5562-419a-93f5-7f10d481c55f	authenticated	authenticated	admin@parket.com.br	$2a$10$ZhdsDOHpSI5nYdhz0TSnSuxLUsYTAm7gu341dJq277I2WuPZ5REZi	2026-03-11 15:24:38.354699+00	\N		\N		\N			\N	2026-06-02 14:37:27.406851+00	{"provider": "email", "providers": ["email"]}	{"role": "superadmin", "full_name": "Administrador", "email_verified": true}	\N	2026-03-11 15:24:38.348721+00	2026-06-02 14:37:27.411012+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	21830af9-fc01-48b0-9bfe-13921a460c5e	authenticated	authenticated	parketpisosbrazil@gmail.com	$2a$10$yk0aVTAzLe6ts189oUEPNurZb8/4oSh/IFMZwqIv9h0v9LOYg/6NW	2026-03-08 06:09:06.049805+00	\N		\N		\N			\N	2026-03-23 21:36:36.779666+00	{"provider": "email", "providers": ["email"]}	{"name": "Douglas 2", "email_verified": true}	\N	2026-03-08 06:09:06.04614+00	2026-03-23 21:36:36.783055+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	c2bde982-c391-4f95-92fe-bd114c24ffb2	authenticated	authenticated	douglas@parket.com.br	$2a$10$lz92NyVI5cpRB3YDa0etOuF0xWEPzBateCMqqerNwUTnvx127IVJW	2026-03-08 05:21:08.78687+00	\N		\N		\N			\N	2026-05-31 00:34:48.303204+00	{"provider": "email", "providers": ["email"]}	{"name": "Douglas", "email_verified": true}	\N	2026-03-08 05:21:08.782257+00	2026-05-31 00:34:48.306687+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	1bdf6feb-c6a8-490b-9bf4-046ffffdc26d	authenticated	authenticated	comercia9@parket.com.br	$2a$10$Vc1uadOadWgJaz3bc2rkO.KPckQcCi9PMmFrhEpLt1nrmU4YZVCNm	2026-03-11 20:10:53.674478+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "RANIERE DE BRITO S ", "email_verified": true, "dept_permissions": {"comercial": "view"}}	\N	2026-03-11 20:10:53.670893+00	2026-03-11 20:10:53.675512+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	b2a47b65-dfde-4a2a-ac65-a85e0b40afde	authenticated	authenticated	comercia6l@parket.com.br	$2a$10$s14YuCiPgV5OyBYNmKYsuORap.f/i5OllAwWxHcC4.XOJ88tD7kT6	2026-03-11 20:09:57.834133+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "viewer", "full_name": "Gustavo Oliveira ", "email_verified": true, "dept_permissions": {}}	\N	2026-03-11 20:09:57.831248+00	2026-03-11 20:09:57.834829+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	163b8870-68a1-49b8-be3d-f1079a0b1eb8	authenticated	authenticated	comercial1@parket.com.br	$2a$10$gi/Y2v8k5fqpOkG0ZPXDseftYufv/kDQBHNWEF/AofiV8oDft395G	2026-05-07 16:43:30.76097+00	\N		\N		\N			\N	2026-06-02 16:20:55.325777+00	{"provider": "email", "providers": ["email"]}	{"role": "admin", "full_name": "Guilherme Fonseca", "email_verified": true, "dept_permissions": {}}	\N	2026-03-11 20:06:22.947513+00	2026-06-02 16:20:55.329807+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	a9258959-7268-49fd-ab8f-a3921edac513	authenticated	authenticated	comercial11@parket.com.br	$2a$10$mRwfgRIvgVHi7NnDpvhfcu0R/CfaopIcn3c2PsUMizlzhs50ZWIl6	2026-03-11 20:11:42.492531+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Vinicius", "email_verified": true, "dept_permissions": {"comercial": "view"}}	\N	2026-03-11 20:11:42.489853+00	2026-03-11 20:11:42.493158+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	c110c0d3-1921-4f92-b14d-fe0b4dfaf4ff	authenticated	authenticated	comercial12@parket.com.br	$2a$10$95ORpQ/LxwQsptvNxt6SkuXNYjgjyr/FQUTEh0wsNmW2kXRtftALq	2026-03-11 20:11:59.788957+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Bruno Silva Gonçalves (Comercial)", "email_verified": true, "dept_permissions": {"comercial": "view"}}	\N	2026-03-11 20:11:59.78631+00	2026-03-11 20:11:59.789606+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	b629c14e-1176-43cd-b529-55eba4165b17	authenticated	authenticated	fiscal1@parket.com.br	$2a$10$OF88973m5BsxrnSl3Ufg2OAYk87.VXzIVWEPiLFJUgkMtzCIiW7Aa	2026-03-11 20:16:50.663803+00	\N		\N		\N			\N	2026-04-13 18:00:45.923869+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "FELIPE OBRAS", "email_verified": true, "dept_permissions": {"fiscal": "view"}}	\N	2026-03-11 20:16:50.660763+00	2026-04-13 18:00:45.927289+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	71d4786b-929b-411b-9d08-81872996ccb2	authenticated	authenticated	admpmo1@parket.com.br	$2a$10$oDO9eisyEBHNPXfrSwOOueSStKovUkJFExUD.5DycVKfKPXKcqWla	2026-03-11 20:19:11.392827+00	\N		\N		\N			\N	2026-03-19 13:03:19.492343+00	{"provider": "email", "providers": ["email"]}	{"role": "viewer", "full_name": "Danyele de Carvalho Victorino", "email_verified": true, "dept_permissions": {"produtividade": "view"}}	\N	2026-03-11 20:19:11.390022+00	2026-03-19 13:03:19.494458+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	6c90091c-a317-41d8-8792-646eebdf5574	authenticated	authenticated	compras2@parket.com.br	$2a$10$dvPUzk..DD4djT/KWmHiiuxl/ESI9DA5vN0gn1B/QpzmBsaaUw2By	2026-03-11 20:14:21.156663+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Taiara Poliana Ferreira Tesim", "email_verified": true, "dept_permissions": {"compras": "view"}}	\N	2026-03-11 20:14:21.154122+00	2026-03-11 20:14:21.157323+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	5b20a326-1814-432b-8182-cd1456f013b0	authenticated	authenticated	fiscal4@parket.com.br	$2a$10$/m/V.fSy9O0FkiejVb7Fl.pJ5YpHP3TpSwcOypfLAiBxNfuHgt7.6	2026-03-11 20:17:37.609833+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Karina", "email_verified": true, "dept_permissions": {"fiscal": "view"}}	\N	2026-03-11 20:17:37.607049+00	2026-03-11 20:17:37.610594+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	626eca64-8622-4002-8fd7-bc4e620c8fcc	authenticated	authenticated	fiscal2@parket.com.br	$2a$10$CHNwUzTfaAmxnt9kk26OG.uc.o68bgVmCj/ZvH.3pMiGvOKYLVFDG	2026-03-11 20:17:03.79149+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Tayna Cristina Galante Jose", "email_verified": true, "dept_permissions": {"fiscal": "view"}}	\N	2026-03-11 20:17:03.788413+00	2026-03-11 20:17:03.792279+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	8792b679-366d-4080-87b3-c2072e1d76c6	authenticated	authenticated	financeiro1@parket.com.br	$2a$10$cNmUV7k7ryLQrZG5QZiMk.pBdlbKRBrh.swdicUFd95hjGfoA0rjC	2026-03-11 20:15:09.115956+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Ivanilda Souza ", "email_verified": true, "dept_permissions": {"financeiro": "view"}}	\N	2026-03-11 20:15:09.113493+00	2026-03-11 20:15:09.116596+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	787a91aa-779d-44af-8b07-77e0c5008411	authenticated	authenticated	expedicao2@parket.com.br	$2a$10$ZMHp11mB1PP8jAg18DhF3uhrE.l8Zgu0wT99Q636JAglqDDj0htQC	2026-03-11 20:18:09.508379+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Ronaldo Felippe ", "email_verified": true, "dept_permissions": {"logistica": "view"}}	\N	2026-03-11 20:18:09.505396+00	2026-03-11 20:18:09.509054+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	827adf88-ee54-4864-8cfb-cb8e6e6f6873	authenticated	authenticated	financeiro2@parket.com.br	$2a$10$iDdGr5ggo6s081U0jwuX.usjB.tB9yHPB.UWm.od/ERHVlBcmLOpa	2026-03-11 20:16:13.589439+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Karla Reinbold ", "email_verified": true, "dept_permissions": {"financeiro": "view"}}	\N	2026-03-11 20:16:13.585101+00	2026-03-11 20:16:13.59035+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	3db8f7c9-72f2-40b3-8b4d-07b63609b771	authenticated	authenticated	fiscal3@parket.com.br	$2a$10$6x0bSPm4R3Oov3aFoenn4u15LeSJTALDljXHpxmRnHaxRxZyS7Rpq	2026-03-11 20:17:24.787468+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Vinicius", "email_verified": true, "dept_permissions": {"fiscal": "view"}}	\N	2026-03-11 20:17:24.784306+00	2026-03-11 20:17:24.788134+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	c3245908-9a07-4a22-9aba-ffa51482ffc4	authenticated	authenticated	pamella@parket.com.br	$2a$10$gAqwsOtRomVk0PHdAiqL0ust9Pcq3O0l.ptBfgaWN0GATGsiZ.frS	2026-05-07 16:43:34.822211+00	\N		\N		\N			\N	2026-05-25 17:09:51.109712+00	{"provider": "email", "providers": ["email"]}	{"role": "admin", "full_name": "Pamella", "email_verified": true, "dept_permissions": {}}	\N	2026-03-11 20:14:46.238956+00	2026-05-25 17:11:10.624801+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	f473c268-d906-4f21-b199-341202544aa7	authenticated	authenticated	marketing3@parket.com.br	$2a$10$tthdfgBKXmAnDwKEcbq4OOFogh.XK1K8qFR/W3CMKV5aWWzmTsa2O	2026-03-11 20:18:50.709671+00	\N		\N		\N			\N	2026-05-28 20:03:05.267379+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Davi", "email_verified": true, "dept_permissions": {"marketing": "view"}}	\N	2026-03-11 20:18:50.706815+00	2026-05-28 20:03:05.271276+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	ff4ff0a4-92eb-4f47-8923-c8c6403c4563	authenticated	authenticated	marketing2@parket.com.br	$2a$10$BDKp/P8fslkGxiLeG8BtKuCwrSaVWSI5yOFsAR.xKiMaZEW85msDS	2026-05-13 13:52:02.257907+00	\N		\N		\N			\N	2026-05-13 13:57:12.651089+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Wilson", "email_verified": true, "dept_permissions": {"marketing": "view"}}	\N	2026-03-11 20:18:39.966478+00	2026-05-13 13:57:12.653825+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	016031f8-9722-4d0f-a33d-d1f46aa862ed	authenticated	authenticated	rh.01@parket.com.br	$2a$10$kqN0K2LPs0eho7B3DBMBU.2/mX8iz1SixzJ9oMCzaN3PEdUdqsnwK	2026-05-07 16:43:38.047397+00	\N		\N		\N			\N	2026-05-07 16:43:55.345939+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Camila Alves", "email_verified": true, "dept_permissions": {"rh": "view"}}	\N	2026-03-11 20:23:27.459663+00	2026-05-07 16:43:55.348067+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	d61602a7-e629-4c5c-b5f6-aa42b53179a5	authenticated	authenticated	logistica1@parket.com.br	$2a$10$5OudiK8L9dOutRc0kxpMH.IN/xOUVq80J8RapDU0wjd33HfOynlha	2026-03-11 20:20:15.254586+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Edson", "email_verified": true, "dept_permissions": {"producao": "view"}}	\N	2026-03-11 20:20:15.251982+00	2026-03-11 20:20:15.255256+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	65cfd0a7-8326-4199-9c3a-bb8e32a2e434	authenticated	authenticated	nathan@parket.com.br	$2a$10$FhjJCB5u88JPNcNpiJdepeJJAeOd6IliqwCI2C5KjpjnV.M5IkO.W	2026-06-02 02:33:21.810303+00	\N		\N		\N			\N	2026-06-02 02:34:06.995987+00	{"provider": "email", "providers": ["email"]}	{"role": "superadmin", "full_name": "Nathan Medeiros", "email_verified": true, "dept_permissions": {}}	\N	2026-03-31 13:43:14.261202+00	2026-06-02 02:34:07.000224+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	b7c228b2-8124-4cbd-84c5-da7465724460	authenticated	authenticated	logistica2@parket.com.br	$2a$10$7cmL1mYmhHT5blTqhIQADOZG4xhy1BCg.4SfEoHZ/3KkSmVkoeqSq	2026-03-11 20:21:26.849533+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "NATALIA FIGUEIREDO", "email_verified": true, "dept_permissions": {"producao": "view"}}	\N	2026-03-11 20:21:26.847049+00	2026-03-11 20:21:26.8502+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	0f74af5f-a4a6-4c9c-b9b4-5021fd8cf8b2	authenticated	authenticated	matheus.lopes@parket.com.br	$2a$10$FMjcJLJuTfNHh7iLRouPa.rHe08cSp2CL9iSgXUdfVJepfgM0nTYu	2026-04-01 19:08:34.804424+00	\N		\N		\N			\N	2026-04-10 19:01:10.007104+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Matheus Lopes", "email_verified": true, "dept_permissions": {"comercial": "manage"}}	\N	2026-04-01 19:08:34.797027+00	2026-04-10 19:01:10.010401+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	a4277727-bdd8-48b5-94a0-72f5859b54b6	authenticated	authenticated	sistemas1@parket.com.br	$2a$10$0t2P2rmqrgosVYTc5hZIMeaAIkE1q30Waa0Z1yp16X5QIJmmIz3qC	2026-03-11 20:24:05.30544+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Alisson de Carvalho", "email_verified": true, "dept_permissions": {"marketing": "view"}}	\N	2026-03-11 20:24:05.302389+00	2026-03-11 20:24:05.306165+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	b373450e-5aed-40eb-abcb-097412615ae5	authenticated	authenticated	rh.02@parket.com.br	$2a$10$oS/i1hKELvvOz0rRGjy8OOxW7Z/WoMTkzH2UqlaqqqblXjpg165XG	2026-05-14 13:36:35.804602+00	\N		\N		\N			\N	2026-05-29 19:58:33.308794+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Talícia Camargo", "email_verified": true, "dept_permissions": {"rh": "view"}}	\N	2026-03-11 20:23:37.910302+00	2026-05-29 19:58:33.312651+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	e00a7127-207d-4d0e-b2b9-beb7a53dd5eb	authenticated	authenticated	sistemas2@parket.com.br	$2a$10$vCeqgHBGhhfDdQTQfG.4KuQ2byhVZ4LQevoAizgy0vMnyXDlefJU6	2026-03-11 20:24:23.724849+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "William Carvalho", "email_verified": true, "dept_permissions": {"marketing": "view"}}	\N	2026-03-11 20:24:23.722066+00	2026-03-11 20:24:23.725508+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	df1d001d-ab08-4424-a07b-fa169576e1ba	authenticated	authenticated	projeto6@parket.com.br	$2a$10$x1ynoTVRYG3qtddQVNpa/OV77YJGrqsTA5vlGPhReeEfj1hT9BnQS	2026-05-07 16:43:36.84952+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Adriele da Rocha Silva", "email_verified": true, "dept_permissions": {"projetos": "edit"}}	\N	2026-04-02 19:05:12.692573+00	2026-05-07 16:43:36.851034+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	e4daff41-5770-4b44-aced-fa836fc22f34	authenticated	authenticated	alex@parket.com.br	$2a$10$HORrOu3z3b91aIKY.3ZXj.Wn4lb9IKqjrrPTp27wgSNDTq2bH3UTi	2026-03-31 13:43:40.711936+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "admin", "full_name": "Alex Fernandes", "email_verified": true, "dept_permissions": {}}	\N	2026-03-31 13:43:40.708374+00	2026-03-31 13:43:40.712629+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	b97abada-6985-4b08-8166-0df9140a6a75	authenticated	authenticated	vinicius.arruda@parket.com.br	$2a$10$vT.yK7ZzKyuRmIEN4t4ZCukmx3ijVNSRwXVmOTUApQPhyKE1fT7WO	2026-05-07 16:43:39.015003+00	\N		\N		\N			\N	2026-06-01 15:18:07.3657+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Vinicius Arruda", "email_verified": true, "dept_permissions": {"comercial": "manage"}}	\N	2026-04-01 19:10:51.966634+00	2026-06-01 15:18:07.367956+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	5cf33342-4b6c-43d4-b66e-35c87468359d	authenticated	authenticated	projetos4@parket.com.br	$2a$10$cXiR/qFCeCgoTLRZV5mvAuUP11Zc5qC20WANT3HJwhRWzz9zlOsQO	2026-03-11 20:22:07.668555+00	\N		\N		\N			\N	2026-06-01 12:38:46.256735+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "THAINARA DOS SANTOS GONÇALVES", "email_verified": true, "dept_permissions": {"projetos": "view"}}	\N	2026-03-11 20:22:07.66585+00	2026-06-01 12:38:46.260913+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	576d0740-9374-479c-9073-579a096afdba	authenticated	authenticated	compras.01@parket.com.br	$2a$10$TrpIue6ne3Icrrz9n0IdIOGU5KagBG1vSAJUn87098j5mwIPvh5RK	2026-05-07 18:02:40.376044+00	\N		\N		\N			\N	2026-06-02 16:25:41.937323+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Ronaldo", "email_verified": true, "dept_permissions": {"compras": "manage"}}	\N	2026-03-19 12:26:15.934018+00	2026-06-02 16:25:41.941389+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	4ef1220e-ace5-41e5-a76c-6efa7b9b8b31	authenticated	authenticated	marketing@parket.com.br	$2a$10$cU32L3v0qjSuhiWHKY/dceTnyfZR5eWDWSHVmUJah5jZRFUXsLek.	2026-05-07 16:43:33.963916+00	\N		\N		\N			\N	2026-06-01 14:51:49.711024+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Raphael Camargo", "email_verified": true, "dept_permissions": {"comercial": "manage", "marketing": "manage"}}	\N	2026-03-27 14:21:13.236293+00	2026-06-01 14:51:49.713116+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	0c9b48b4-4b98-4fdd-88c4-db7f29ca95bf	authenticated	authenticated	projetos8@parket.com.br	$2a$10$2szGseCL6Qnh3JqWWo7Za.ga.qkGqtos3iJ8P6ZvVHXuwwvjW3Zna	2026-05-07 16:43:37.576492+00	\N		\N		\N			\N	2026-05-07 16:43:56.007876+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Caetano Magno Ferreira", "email_verified": true, "dept_permissions": {"producao": "manage"}}	\N	2026-04-02 19:05:34.853341+00	2026-05-07 16:43:56.010667+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	f80aa976-1598-4b60-a6ca-9d63458d0a5f	authenticated	authenticated	projeto7@parket.com.br	$2a$10$9eqtTQ5QDouQXsKg69rBc.FeHAIQBxigvpDTfnhYDq5cCHSNNq0de	2026-05-07 16:43:37.075925+00	\N		\N		\N			\N	2026-06-02 16:14:48.453525+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Bruno", "email_verified": true, "dept_permissions": {"projetos": "edit"}}	\N	2026-04-02 19:05:34.360456+00	2026-06-02 16:14:48.457577+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	b7ceff48-923f-4e61-ae71-deee2f8b4b9b	authenticated	authenticated	rh.03@parket.com.br	$2a$10$qunhwgnyda3s2wjFtBhx6uVEuqpiuwvesf3ky5Frw2H2DH4DXnwKy	2026-05-07 16:43:38.269068+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "CAMILA  ALVES NONATO", "email_verified": true, "dept_permissions": {"rh": "view"}}	\N	2026-04-02 19:05:35.353498+00	2026-05-07 16:43:38.270517+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	2c3ffe1a-1a00-457d-9820-1af0660f3715	authenticated	authenticated	gilvan@parket.com.br	$2a$10$SVtAEHJln8dzU7fn54.q7u6yF5JBH5cDVICB5O3hY9bDLaT7OeMK.	2026-05-07 16:43:33.086136+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "GILVAN FREITAS SANTANA", "email_verified": true, "dept_permissions": {"producao": "view"}}	\N	2026-04-02 19:05:39.290089+00	2026-05-07 16:43:33.087786+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	fbb20dbe-6c2f-45ce-804b-abf8aed6ee30	authenticated	authenticated	felipe.lessa@parket.com.br	$2a$10$010qVcwWsq5ZjmU9O4uEUep6Hd3rWBie4VmwM8qNH/6QV5oO8MsPy	2026-05-07 16:43:32.382177+00	\N		\N		\N			\N	2026-05-25 15:45:46.53301+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Felipe Lessa", "email_verified": true, "dept_permissions": {"comercial": "edit", "comercial_mode": "meu_funil"}}	\N	2026-04-02 19:05:37.818896+00	2026-05-25 15:45:46.536276+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	6028ba2b-3fcc-4be4-8c12-0d085b16a21f	authenticated	authenticated	obras@parket.com.br	$2a$10$j.nY4v3A76bVoXWgYKIKG.g5sZPPqANKhkOIYyXEyViAd1XXs6FDS	2026-05-07 16:43:34.602605+00	\N		\N		\N			\N	2026-05-28 10:24:39.530062+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Felipe Silveira Penha", "email_verified": true, "dept_permissions": {"fiscal": "manage"}}	\N	2026-04-02 19:05:37.333137+00	2026-05-28 10:24:39.533474+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	b626d259-e784-4be3-9472-6c84d3572f1c	authenticated	authenticated	expedicao@parket.com.br	$2a$10$75djVXgQ2Ge6MJUTOJoMDunhXvp.lci5RsTubhHVp88PXyHgCvwnW	2026-05-07 16:43:32.136901+00	\N		\N		\N			\N	2026-05-29 10:37:44.733779+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Ailton Gomes de Lima", "email_verified": true, "dept_permissions": {}}	\N	2026-04-02 19:05:32.392067+00	2026-05-29 10:37:44.736791+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	6c198a4e-a9b3-450c-84a3-95a74823db70	authenticated	authenticated	projeto9@parket.com.br	$2a$10$..jpwMwKVZRR15ifMIWnDeRUm4HNzvtkYZLwV0kuXNJUmhE6vzceK	2026-05-07 16:43:37.307417+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Gabrieli Maria dos Anjos de Souza", "email_verified": true, "dept_permissions": {"projetos": "edit"}}	\N	2026-04-02 19:05:38.305213+00	2026-05-07 16:43:37.308949+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	48af8a7e-96ed-4dec-ba5e-482b41be4361	authenticated	authenticated	projeto2@parket.com.br	$2a$10$Bnk6PvGG0Tjyi41yxgXIMOlvsluTTk.tAhQSd1.I3KAaXdfAYm6/i	2026-05-07 16:43:35.953181+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Germano Schloegl", "email_verified": true, "dept_permissions": {"projetos": "edit"}}	\N	2026-04-02 19:05:38.804278+00	2026-05-07 16:43:35.954829+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	cdb34c89-a56b-44f9-a906-fe07a8c782d8	authenticated	authenticated	cristian@parket.com.br	$2a$10$PcXppJ8qew/U3ARn11c3Y.LFQDBNxKVysZul4wqmjJrx88xVsc3te	2026-05-07 16:43:31.664675+00	\N		\N		\N			\N	2026-05-28 19:32:45.40275+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Cristian Lopes", "email_verified": true, "dept_permissions": {"comercial": "edit", "comercial_mode": "meu_funil"}}	\N	2026-04-02 19:05:35.861928+00	2026-05-28 19:32:45.40652+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	6da1834b-6fd9-493f-87a7-d3ae4a90fb22	authenticated	authenticated	fabio@parket.com.br	$2a$10$LVoKsJjDwGp2XQuizqw.lOCSGgS4/HXuz7k9Ttev.7/MPNj1yfbVu	2026-04-02 19:05:36.835955+00	\N		\N		\N			\N	2026-05-28 14:59:34.51416+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Fabio Figueredo", "email_verified": true, "dept_permissions": {"comercial": "edit", "comercial_mode": "meu_funil"}}	\N	2026-04-02 19:05:36.833391+00	2026-05-28 14:59:34.516592+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	708e0503-f2a8-4024-812a-0a3068ed5e8b	authenticated	authenticated	atendimento.01@parket.com.br	$2a$10$7wRkk17gjKKxSoHOEtQQ3uSOvJkwRVEzNjkt76OmL1cxhGs90E1A.	2026-05-07 16:43:30.528336+00	\N		\N		\N			\N	2026-05-30 11:51:47.933799+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Atendimento Parket", "email_verified": true, "dept_permissions": {"atendimento": "view"}}	\N	2026-04-02 19:05:33.379052+00	2026-05-30 11:51:47.937371+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	e021c120-1c8d-490d-8407-166b57d8ebce	authenticated	authenticated	projeto5@parket.com.br	$2a$10$CGCOa0uSH2Tm8.COll43t.KGvXDNrW6J/y5u/Nl56XYoH2M.TEAyW	2026-05-07 16:43:36.629061+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Brenda Perez de Lima Marques Silva", "email_verified": true, "dept_permissions": {"projetos": "edit"}}	\N	2026-04-02 19:05:33.867047+00	2026-05-07 16:43:36.630604+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	ee31cc52-11d4-4477-afda-571b9acb2f83	authenticated	authenticated	davi@parket.com.br	$2a$10$UMv6HJ8d.WbjD.6Jw8vB9.rK.KUGzpgb8.L9g3aM4sd7opcpm778u	2026-04-02 19:05:36.352837+00	\N		\N		\N			\N	2026-06-02 15:51:08.625029+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Davi Alves Baptista", "email_verified": true, "dept_permissions": {"comercial": "edit", "comercial_mode": "meu_funil"}}	\N	2026-04-02 19:05:36.350146+00	2026-06-02 15:51:08.628763+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	e7fbc22c-5bd9-4e26-8652-1d9c6dbf12c9	authenticated	authenticated	karla@parket.com.br	$2a$10$jQnQHWEeMI7e.x41jfATT.mw5LKpvM7lvrOvZlCh0E0jeveza/34m	2026-05-07 16:43:33.744925+00	\N		\N		\N			\N	2026-05-25 13:37:55.685259+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Karla Reinbold", "email_verified": true, "dept_permissions": {"financeiro": "view"}}	\N	2026-04-02 19:05:41.770066+00	2026-05-25 13:37:55.687895+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	dd0d676b-12f5-4e55-895e-6b31e26af81e	authenticated	authenticated	projeto1@parket.com.br	$2a$10$xjhoHn6CORwzccdokFYjcuzAQaj9Gv1fvH5xdxB1A8ErwYYFPqugW	2026-05-07 16:43:35.495288+00	\N		\N		\N			\N	2026-06-02 11:04:08.357056+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Joyce Silva de Jesus", "email_verified": true, "dept_permissions": {"orcamento": "edit"}}	\N	2026-04-02 19:05:40.782251+00	2026-06-02 11:04:08.361016+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	8a29beb1-2165-4a2e-9271-0a31c8113db8	authenticated	authenticated	murilo@parket.com.br	$2a$10$tXr9lpJ.L.Kx4JMLi6V/k.KUCOgoC27e8ENmAGNh279mZ.uSc8JfW	2026-05-07 16:43:34.372938+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Murilo", "email_verified": true, "dept_permissions": {"comercial": "edit", "comercial_mode": "meu_funil"}}	\N	2026-04-02 19:05:42.74506+00	2026-05-07 16:43:34.374526+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	822796ab-5acd-4c23-aa1c-b2e960420413	authenticated	authenticated	projeto3@parket.com.br	$2a$10$6RnQW6r0HBsstPLbyd.ENu8HTByGEtR.xv.S2qAOUJQ5r422zrrP.	2026-05-07 16:43:36.184848+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Tayná Cristina Galante Jose", "email_verified": true, "dept_permissions": {"projetos": "edit"}}	\N	2026-04-02 19:05:45.778384+00	2026-05-07 16:43:36.186339+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	66654dde-4a91-416b-b4df-c7fe19a3e883	authenticated	authenticated	financeiro@parket.com.br	$2a$10$aAkSTxe/9vQLtS2oolLLre34ZF8cj5Pg4FTg.azPwvgQY1BkBekKG	2026-05-07 16:43:32.602197+00	\N		\N		\N			\N	2026-05-25 13:39:36.320838+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Karla Reinbold", "email_verified": true, "dept_permissions": {"financeiro": "view"}}	\N	2026-04-02 19:05:41.280495+00	2026-05-25 13:39:36.324538+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	1b73b493-4c45-41c5-9cf9-bd101f5fcb74	authenticated	authenticated	guilherme@parket.com.br	$2a$10$sDHWdbvnAiMEC1pc.b7B2Od21PfldZzFTef3Y/igzWLgNR07kJ6YW	2026-05-07 16:43:33.301817+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Guilherme Milleta", "email_verified": true, "dept_permissions": {"comercial": "edit", "comercial_mode": "meu_funil"}}	\N	2026-04-02 19:05:39.785489+00	2026-05-07 16:43:33.303452+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	2ef2ea49-e507-458d-9124-bc05a75c57e7	authenticated	authenticated	fiscal01@parket.com.br	$2a$10$aBxO/68SenIby3xuIPCb6eVhF.Bs4cdRW6iTWoDvfbv7zi8eT0.o6	2026-05-07 16:43:32.837107+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Ronaldo Silveira Penha", "email_verified": true, "dept_permissions": {"fiscal": "manage"}}	\N	2026-04-02 19:05:44.247856+00	2026-05-07 16:43:32.83861+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	6893df91-b552-40df-9722-4c95e23e5df8	authenticated	authenticated	pcp@parket.com.br	$2a$10$o1XBC6yvGOYximAR1hwLHOhe1.lvnh9CR28YdWdApHXjXWsHxlBO2	2026-05-07 16:43:35.054948+00	\N		\N		\N			\N	2026-05-07 16:31:59.551336+00	{"erp_role": "producao", "provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Natália Figueiredo", "email_verified": true, "dept_permissions": {"logistica": "manage"}}	\N	2026-04-02 19:05:43.257786+00	2026-05-07 16:43:35.056513+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	357569e3-5ebc-4295-ad34-13a2014bdf0b	authenticated	authenticated	raniere@parket.com.br	$2a$10$psEIHilzZj4jbgdyzIgcneH/1FYAW3hz8BimAQ71Xm6pEkijkLlYO	2026-05-07 16:43:37.818537+00	\N		\N		\N			\N	2026-06-02 14:08:18.531148+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Ranieri Brito", "email_verified": true, "dept_permissions": {"orcamento": "edit"}}	\N	2026-04-02 19:05:43.749284+00	2026-06-02 14:08:18.535187+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	4057a41d-e43f-49ed-911c-4f551e6bd9d0	authenticated	authenticated	projeto10@parket.com.br	$2a$10$rfgp16bkxyA9ypjq2ll8TOoTTqjouIXatQpifNLg55l8nzE5pITZ.	2026-05-07 16:43:35.721601+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Herley dos Santos de Souza", "email_verified": true, "dept_permissions": {"projetos": "edit"}}	\N	2026-04-02 19:05:40.277523+00	2026-05-07 16:43:35.723151+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	02c64bf6-3d41-4ad9-bed8-820843816230	authenticated	authenticated	projeto4@parket.com.br	$2a$10$jjiAmX04g2hMSd7bsrx5beawLRt0bhim2d9XUqXs9AjqRKeoeYhXq	2026-05-07 16:43:36.39981+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Thainara dos Santos Gonçalves", "email_verified": true, "dept_permissions": {"projetos": "edit"}}	\N	2026-04-02 19:05:46.280358+00	2026-05-07 16:43:36.401372+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	15686346-f8ea-42ad-aeae-8666b7021ad0	authenticated	authenticated	will@parket.com.br	$2a$10$ytWk44M7Inpws/hTi32dSOMjCwPYq1a/P42w8oDVWLpPQgQMWjByS	2026-05-07 16:43:39.26889+00	\N		\N		\N			\N	2026-05-05 13:37:28.684439+00	{"erp_role": "admin", "provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Will Carvalho", "email_verified": true, "dept_permissions": {"ia": "manage"}}	\N	2026-04-02 19:05:46.771659+00	2026-05-07 16:43:39.270436+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	a15fc367-4eaa-47c7-bc5f-dcb8909e004d	authenticated	authenticated	sueli@parket.com.br	$2a$10$zz9jsqLLCAyQQvGwspRqKe88RBxNn89qu8HBgEwGHlDh0D9JPrBr6	2026-05-07 16:43:38.525583+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Sueli Jorge", "email_verified": true, "dept_permissions": {"comercial": "edit", "comercial_mode": "meu_funil"}}	\N	2026-04-02 19:05:44.776648+00	2026-05-07 16:43:38.527094+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	45cd376c-e0b4-4fd4-a156-7332b4f28dab	authenticated	authenticated	compras@parket.com.br	$2a$10$VZOusPP50aKE1EDzNKxDKO/kULSNmtGwzHf/bWobVlW6vYo.DZJfS	2026-05-07 16:43:31.21297+00	\N		\N		\N			\N	2026-06-01 10:12:07.080711+00	{"erp_role": "admin", "provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Taiara Poliana Ferreira Tesim", "email_verified": true, "dept_permissions": {"compras": "edit"}}	\N	2026-04-02 19:05:45.281999+00	2026-06-01 10:12:07.084446+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	008f38cf-1af6-40a5-ac92-657d3b15e14f	authenticated	authenticated	anapaula@parket.com.br	$2a$10$r/FE799Ko1dc8AiRhNI76eapGeF0Y.1PFdBClU8dmGtWIh.K.nO5i	2026-05-07 16:43:30.040952+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Ana Paula Pereira Varaschin", "email_verified": true, "dept_permissions": {"comercial": "edit", "comercial_mode": "meu_funil"}}	\N	2026-04-02 19:05:32.888363+00	2026-05-07 16:43:30.045064+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	f0647ffa-a8df-4ba3-9d37-49b54f5395ee	authenticated	authenticated	marina@parket.com.br	$2a$10$syNYbq0llgaRfqOSNOCWgu1Tu5QXc1osgNEA9xFgyyk1QNECJ3KlO	2026-04-02 19:05:48.236554+00	\N		\N		\N			\N	2026-05-29 12:10:19.108355+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Marina Torino", "email_verified": true, "dept_permissions": {"comercial": "edit"}}	\N	2026-04-02 19:05:48.233907+00	2026-05-29 12:10:19.112074+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	6838b1c7-c1ce-4da8-bff2-03b70b14954b	authenticated	authenticated	bielvict269@gmail.com	$2a$10$TK3d9RS83kbG5T4j2JvJB.nF5C7udUncgsDmDW19DLEpQPJ6vuqkq	2026-04-09 17:54:36.309181+00	\N		\N		\N			\N	2026-04-09 17:54:36.314312+00	{"provider": "email", "providers": ["email"]}	{"sub": "6838b1c7-c1ce-4da8-bff2-03b70b14954b", "email": "bielvict269@gmail.com", "email_verified": true, "phone_verified": false}	\N	2026-04-09 17:54:36.301755+00	2026-04-11 17:21:23.927446+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	1b13d372-cf85-4da7-8e77-8d5012314348	authenticated	authenticated	douglas2@parket.com.br	$2a$10$XTRA3UZMlRfRoFaSqN8/EOOPDJbLwb8bR3tmIMxImzY36vvNWiWGS	2026-04-07 16:16:59.191805+00	\N		\N		\N			\N	2026-04-07 16:16:59.195275+00	{"provider": "email", "providers": ["email"]}	{"sub": "1b13d372-cf85-4da7-8e77-8d5012314348", "email": "douglas2@parket.com.br", "email_verified": true, "phone_verified": false}	\N	2026-04-07 16:16:59.18383+00	2026-04-10 16:15:00.43876+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	ac010407-4d32-4909-9a35-5b2c1cb847bb	authenticated	authenticated	douglas@injexia.com	$2a$10$lSPaFPnueTWgH3gdM1I/ceuKw.q6QaCObVP5VnmOWhACg/Kksr/xm	2026-04-07 17:46:26.126849+00	\N		\N		\N			\N	2026-05-29 23:37:32.945892+00	{"provider": "email", "providers": ["email"]}	{"sub": "ac010407-4d32-4909-9a35-5b2c1cb847bb", "email": "douglas@injexia.com", "email_verified": true, "phone_verified": false}	\N	2026-04-07 17:46:26.118421+00	2026-05-29 23:37:32.94995+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	1074978b-504e-49d2-b559-8bda7af8085e	authenticated	authenticated	admin@injexia.com	$2a$10$WY3UDK4365j3sG/iZQ5p2Ollo21hKlwWmuYQLZp8IKEqrH4Hxr7cO	2026-04-06 23:25:33.14678+00	\N		\N		\N			\N	2026-04-29 17:04:35.545778+00	{"provider": "email", "providers": ["email"]}	{"sub": "1074978b-504e-49d2-b559-8bda7af8085e", "email": "admin@injexia.com", "email_verified": true, "phone_verified": false}	\N	2026-04-06 23:25:33.139633+00	2026-04-29 17:04:35.549329+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	51570c7c-32e1-43db-abf5-4ee22512641c	authenticated	authenticated	juniorartevisual@gmail.com	$2a$10$auZhi0W/f195/8YASvthgOFzrdDs899gst3RZpj3F.Boavo81DWSi	2026-04-07 19:35:25.311202+00	\N		\N		\N			\N	2026-04-07 19:35:25.314916+00	{"provider": "email", "providers": ["email"]}	{"sub": "51570c7c-32e1-43db-abf5-4ee22512641c", "email": "juniorartevisual@gmail.com", "email_verified": true, "phone_verified": false}	\N	2026-04-07 19:35:25.30335+00	2026-04-07 19:35:25.317882+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	0c351d18-2776-40b4-873a-253a1ba42606	authenticated	authenticated	willabc@gmail.com	$2a$10$hUhhv7klknGN84mvrMF4KOLVMmUutsSI9T/q6VWbUPB1VdtQSorzu	2026-04-10 16:16:02.071028+00	\N		\N		\N			\N	2026-04-10 16:16:02.075451+00	{"provider": "email", "providers": ["email"]}	{"sub": "0c351d18-2776-40b4-873a-253a1ba42606", "email": "willabc@gmail.com", "email_verified": true, "phone_verified": false}	\N	2026-04-10 16:16:02.063613+00	2026-04-10 16:16:02.078201+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	b3ba1a3f-c7a7-4b31-996e-8a72293fa54c	authenticated	authenticated	will2@gmail.com	$2a$10$V3CVMTwQlVhZLtas.S93U.q9DK1nyup0m4pF3nD0Tx9VvohpPEisu	2026-04-11 17:32:35.979605+00	\N		\N		\N			\N	2026-04-11 17:32:35.982999+00	{"provider": "email", "providers": ["email"]}	{"sub": "b3ba1a3f-c7a7-4b31-996e-8a72293fa54c", "email": "will2@gmail.com", "email_verified": true, "phone_verified": false}	\N	2026-04-11 17:32:35.971953+00	2026-04-11 17:32:35.985629+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	6cb6c215-f16e-4ef6-b1ed-e4a203b3570a	authenticated	authenticated	admin02@injexia.com.br	$2a$10$uQxI2z0EVCjnXmIkzozkpuTrRi.1PTtK7G5Y5nDcVAC0JWuoGz9ce	2026-04-07 00:22:23.120404+00	\N		\N		\N			\N	2026-04-07 00:22:23.125861+00	{"provider": "email", "providers": ["email"]}	{"sub": "6cb6c215-f16e-4ef6-b1ed-e4a203b3570a", "email": "admin02@injexia.com.br", "email_verified": true, "phone_verified": false}	\N	2026-04-07 00:22:23.112768+00	2026-04-15 20:34:32.933106+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	73dd2983-7f59-485d-a69b-1d1fc30adb4d	authenticated	authenticated	thayna.orcamento@parket.com.br	$2a$10$cGXMaZGwhXu6QU1WLAch4O4RMt1.vM8izO1DN/Wweh2MZo0yiVt5S	2026-05-07 16:43:38.800778+00	\N		\N		\N			\N	2026-06-02 17:00:00.614761+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Thayna Rodrigues", "email_verified": true, "dept_permissions": {"orcamento": "manage"}}	\N	2026-04-27 13:16:17.456302+00	2026-06-02 17:00:00.671145+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	917316ea-c6f0-4b7b-bcc4-c64feb11379a	authenticated	authenticated	assistente.marcenaria@parket.com.br	$2a$10$/2O/ZU75amUwpGzwikQ9dO2fgktxYvHT6vslwGP5KatpoF8XQqe1e	2026-05-07 16:43:30.289149+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Maria Eduarda Becker", "email_verified": true, "dept_permissions": {"producao": "view"}}	\N	2026-04-02 19:05:42.261617+00	2026-05-07 16:43:30.290969+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	0410679e-c89c-48d9-b314-ec9a174317fe	authenticated	authenticated	will.tape@gmail.com	$2a$10$ucbebJANRY662j7zi1soVuJFWxZfcyOm/CpoNyI2ETUA4zO5YzYWC	2026-04-06 23:59:13.1233+00	\N		\N		2026-05-06 18:36:08.986308+00			\N	2026-05-06 18:36:09.202587+00	{"erp_role": "admin", "provider": "email", "providers": ["email"]}	{"sub": "0410679e-c89c-48d9-b314-ec9a174317fe", "email": "will.tape@gmail.com", "email_verified": true, "phone_verified": false}	\N	2026-04-06 23:59:13.114922+00	2026-05-06 18:36:09.205748+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	f090d5e9-a677-41b5-a764-4c56d0dc2a7a	authenticated	authenticated	gustavo@parket.com.br	$2a$10$hZzKdm8h662QhzeJtmlVwOcsMlS4QWpVczDpUl66dqeqo9FPIedpS	2026-05-07 16:43:33.523807+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Gustavo Oliveira", "email_verified": true, "dept_permissions": {"comercial": "edit", "comercial_mode": "meu_funil"}}	\N	2026-04-02 19:05:47.25039+00	2026-05-07 16:43:33.525351+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	52517f1b-2361-439c-9481-b56f92d9866e	authenticated	authenticated	contratos@parket.com.br	$2a$10$gkUVvkdMvjx1jS3XsuOcKeNsttgkX8W.iGDVBUJkqQyXPpWcoCsBu	2026-05-07 16:43:31.433842+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Karlla Reinbold", "email_verified": true, "dept_permissions": {"financeiro": "view"}}	\N	2026-04-02 19:05:47.731792+00	2026-05-07 16:43:31.43775+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	fc0ee353-1c2d-4ebe-b6fb-4a2be8d677b8	authenticated	authenticated	danyele@parket.com.br	$2a$10$uSNk/F0Lt2jFPnd5mT3g6ubzLCtNBxNfnzhMNsDvjTWAswZ.tzzUu	2026-05-07 16:43:31.902615+00	\N		\N		\N			\N	2026-05-21 18:10:35.932384+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Danyele", "email_verified": true, "dept_permissions": {"obras": "manage", "fiscal": "view", "atendimento": "view", "produtividade": "view"}}	\N	2026-04-15 19:43:50.285798+00	2026-05-21 18:10:35.936094+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	9b3e5e1b-8fc1-4383-886a-b12d6143e1e3	authenticated	authenticated	davi.fiscal@parket.com.br	$2a$10$kdJCTW4ehcYDrw.df1qoMuGbYUqX6V96.HEqubjbSzukzH6nhxLua	2026-05-22 16:07:17.386239+00	\N		\N		\N			\N	2026-05-26 13:41:21.021445+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Davi fiscal", "email_verified": true, "dept_permissions": {}}	\N	2026-05-22 16:07:17.380821+00	2026-05-26 13:41:21.025034+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	4601f488-e360-4879-8e50-b7b194bdf642	authenticated	authenticated	alvaro@parket.com.br	$2a$10$ukoAM51iMKWukaDKcCGniek7EX4B4pkkE.y0tg4PEw3iSNiW.zOQC	2026-05-15 16:46:24.411104+00	\N		\N		\N			\N	2026-05-30 00:24:05.250926+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Alvo Jose", "email_verified": true, "dept_permissions": {"obras": "view"}}	\N	2026-05-15 16:46:24.396635+00	2026-05-30 00:24:05.254715+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	687de092-044b-4513-bfe4-97e15189d55c	authenticated	authenticated	claudetest3@parket.local	$2a$10$4VqjF/PC0Rxh9xG9hZASEemnxPsI.ZOGb7SOb9O0ErlkZbTA0536G	2026-05-26 13:49:19.362101+00	\N		\N		\N			\N	2026-05-26 13:57:36.03424+00	{"provider": "email", "providers": ["email"]}	{"email_verified": true}	\N	2026-05-26 13:49:19.356887+00	2026-05-26 13:57:36.039423+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	a698ccf9-5056-4893-95df-de4bedc95f6a	authenticated	authenticated	planejamento@parket.com.br	$2a$10$.sZgUl86EXXe8xjddYUsTeNMOOZ5nuf4pY8sGE0ffPONXxyM1EKzG	2026-05-07 16:43:35.281263+00	\N		\N		\N			\N	2026-06-01 01:36:07.586732+00	{"provider": "email", "providers": ["email"]}	{"role": "dept_leader", "full_name": "Natália Alves Barbosa", "email_verified": true, "dept_permissions": {"obras": "manage", "fiscal": "manage", "atendimento": "manage", "produtividade": "manage"}}	\N	2026-03-23 19:18:34.306174+00	2026-06-01 01:36:07.590616+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	502a7b87-2275-4cc3-aadf-6bd5df105717	authenticated	authenticated	rafael.calazans@parket.com.br	$2a$10$BrMLhUHWnZPPmPjS0FWOIO9o3LvCYg841FJg4MruyBaU6bLzY5yMm	2026-05-11 12:17:40.961875+00	\N		\N		\N			\N	2026-06-01 14:02:57.626928+00	{"provider": "email", "providers": ["email"]}	{"role": "viewer", "full_name": "Rafael", "email_verified": true, "dept_permissions": {"comercial": "manage"}}	\N	2026-05-11 12:17:40.949004+00	2026-06-01 14:02:57.629512+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	ecf89521-35fe-4134-b5c0-8329de87dea2	authenticated	authenticated	cristiano@parket.com.br	$2a$10$S.jk1rtF.mUY2v8kz2m.GOK0K16t2OPGzx0jIvbDlSxV6/6/Wy.h6	2026-05-22 15:20:34.962699+00	\N		\N		\N			\N	2026-05-28 12:43:18.733156+00	{"provider": "email", "providers": ["email"]}	{"role": "viewer", "full_name": "Cristiano Fiscal", "email_verified": true, "dept_permissions": {"fiscal": "view"}}	\N	2026-05-22 15:20:34.949073+00	2026-05-28 12:43:18.737037+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


ALTER TABLE auth.users ENABLE TRIGGER ALL;

--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.identities DISABLE TRIGGER ALL;

COPY auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) FROM stdin;
c2bde982-c391-4f95-92fe-bd114c24ffb2	c2bde982-c391-4f95-92fe-bd114c24ffb2	{"sub": "c2bde982-c391-4f95-92fe-bd114c24ffb2", "email": "douglas@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-08 05:21:08.784278+00	2026-03-08 05:21:08.784333+00	2026-03-08 05:21:08.784333+00	1e4fd375-43dc-4135-8a73-32e6474a2d13
21830af9-fc01-48b0-9bfe-13921a460c5e	21830af9-fc01-48b0-9bfe-13921a460c5e	{"sub": "21830af9-fc01-48b0-9bfe-13921a460c5e", "email": "parketpisosbrazil@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-03-08 06:09:06.047679+00	2026-03-08 06:09:06.04773+00	2026-03-08 06:09:06.04773+00	95d84d2e-4330-4110-a5b0-617f7c7af67d
c0bac305-5562-419a-93f5-7f10d481c55f	c0bac305-5562-419a-93f5-7f10d481c55f	{"sub": "c0bac305-5562-419a-93f5-7f10d481c55f", "email": "admin@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 15:24:38.352791+00	2026-03-11 15:24:38.352845+00	2026-03-11 15:24:38.352845+00	4f1c1e2e-b98f-4b46-b09b-46789cdc1a97
163b8870-68a1-49b8-be3d-f1079a0b1eb8	163b8870-68a1-49b8-be3d-f1079a0b1eb8	{"sub": "163b8870-68a1-49b8-be3d-f1079a0b1eb8", "email": "comercial1@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:06:22.948978+00	2026-03-11 20:06:22.949028+00	2026-03-11 20:06:22.949028+00	06bb5baa-c3ea-42a2-85d8-c76b48878304
24ec4b5b-f538-49ed-ad33-1b97c8d2ede6	24ec4b5b-f538-49ed-ad33-1b97c8d2ede6	{"sub": "24ec4b5b-f538-49ed-ad33-1b97c8d2ede6", "email": "comercial3@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:07:49.055451+00	2026-03-11 20:07:49.055497+00	2026-03-11 20:07:49.055497+00	3e67e775-081e-4aeb-a001-548ba42dc0ad
00c01c83-69c3-4be5-81f4-0ac4ef19faa1	00c01c83-69c3-4be5-81f4-0ac4ef19faa1	{"sub": "00c01c83-69c3-4be5-81f4-0ac4ef19faa1", "email": "comercial5@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:09:47.525555+00	2026-03-11 20:09:47.525599+00	2026-03-11 20:09:47.525599+00	98e60497-73b4-4084-b654-3ca27a53962f
b2a47b65-dfde-4a2a-ac65-a85e0b40afde	b2a47b65-dfde-4a2a-ac65-a85e0b40afde	{"sub": "b2a47b65-dfde-4a2a-ac65-a85e0b40afde", "email": "comercia6l@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:09:57.832502+00	2026-03-11 20:09:57.832551+00	2026-03-11 20:09:57.832551+00	307a2661-395a-4313-b389-afaf0bf0043c
c59939ea-e086-4e8d-9b36-bda2dd39bb4d	c59939ea-e086-4e8d-9b36-bda2dd39bb4d	{"sub": "c59939ea-e086-4e8d-9b36-bda2dd39bb4d", "email": "comercial7@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:10:25.113758+00	2026-03-11 20:10:25.113809+00	2026-03-11 20:10:25.113809+00	20bb957e-c8f4-4d62-abf6-f6f1fba22c58
1bdf6feb-c6a8-490b-9bf4-046ffffdc26d	1bdf6feb-c6a8-490b-9bf4-046ffffdc26d	{"sub": "1bdf6feb-c6a8-490b-9bf4-046ffffdc26d", "email": "comercia9@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:10:53.672165+00	2026-03-11 20:10:53.672213+00	2026-03-11 20:10:53.672213+00	5c9dcc47-4e49-4ea8-bba1-e8d5ed52feee
cc185abf-3b26-4258-b742-266901e5e921	cc185abf-3b26-4258-b742-266901e5e921	{"sub": "cc185abf-3b26-4258-b742-266901e5e921", "email": "comercial10@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:11:08.80272+00	2026-03-11 20:11:08.802771+00	2026-03-11 20:11:08.802771+00	82123654-0379-4ae8-bb08-67423115a2cb
a9258959-7268-49fd-ab8f-a3921edac513	a9258959-7268-49fd-ab8f-a3921edac513	{"sub": "a9258959-7268-49fd-ab8f-a3921edac513", "email": "comercial11@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:11:42.491178+00	2026-03-11 20:11:42.491238+00	2026-03-11 20:11:42.491238+00	8c88a229-410a-4d64-b298-1f25f3981add
c110c0d3-1921-4f92-b14d-fe0b4dfaf4ff	c110c0d3-1921-4f92-b14d-fe0b4dfaf4ff	{"sub": "c110c0d3-1921-4f92-b14d-fe0b4dfaf4ff", "email": "comercial12@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:11:59.787694+00	2026-03-11 20:11:59.78774+00	2026-03-11 20:11:59.78774+00	b4b40221-0c53-40bf-afd4-57eaa657c589
6c90091c-a317-41d8-8792-646eebdf5574	6c90091c-a317-41d8-8792-646eebdf5574	{"sub": "6c90091c-a317-41d8-8792-646eebdf5574", "email": "compras2@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:14:21.155397+00	2026-03-11 20:14:21.155447+00	2026-03-11 20:14:21.155447+00	d2bcc93e-67bc-44f9-a864-10fc6e6f1b28
c3245908-9a07-4a22-9aba-ffa51482ffc4	c3245908-9a07-4a22-9aba-ffa51482ffc4	{"sub": "c3245908-9a07-4a22-9aba-ffa51482ffc4", "email": "pamella@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:14:46.24011+00	2026-03-11 20:14:46.240154+00	2026-03-11 20:14:46.240154+00	8119292c-6de5-4e71-8aa5-edc20f4258c1
8792b679-366d-4080-87b3-c2072e1d76c6	8792b679-366d-4080-87b3-c2072e1d76c6	{"sub": "8792b679-366d-4080-87b3-c2072e1d76c6", "email": "financeiro1@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:15:09.114708+00	2026-03-11 20:15:09.114756+00	2026-03-11 20:15:09.114756+00	94f0a875-852f-4573-87e4-c3e704c84aa4
827adf88-ee54-4864-8cfb-cb8e6e6f6873	827adf88-ee54-4864-8cfb-cb8e6e6f6873	{"sub": "827adf88-ee54-4864-8cfb-cb8e6e6f6873", "email": "financeiro2@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:16:13.587746+00	2026-03-11 20:16:13.587795+00	2026-03-11 20:16:13.587795+00	f0af8101-3337-40d4-89bc-ce3a30c5860b
b629c14e-1176-43cd-b529-55eba4165b17	b629c14e-1176-43cd-b529-55eba4165b17	{"sub": "b629c14e-1176-43cd-b529-55eba4165b17", "email": "fiscal1@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:16:50.662412+00	2026-03-11 20:16:50.66246+00	2026-03-11 20:16:50.66246+00	735232f5-7e3a-4166-a06c-3bb451a87ba6
626eca64-8622-4002-8fd7-bc4e620c8fcc	626eca64-8622-4002-8fd7-bc4e620c8fcc	{"sub": "626eca64-8622-4002-8fd7-bc4e620c8fcc", "email": "fiscal2@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:17:03.789904+00	2026-03-11 20:17:03.789967+00	2026-03-11 20:17:03.789967+00	09498e6a-930b-4ee3-891c-a8bdaed9fcd4
3db8f7c9-72f2-40b3-8b4d-07b63609b771	3db8f7c9-72f2-40b3-8b4d-07b63609b771	{"sub": "3db8f7c9-72f2-40b3-8b4d-07b63609b771", "email": "fiscal3@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:17:24.78566+00	2026-03-11 20:17:24.785713+00	2026-03-11 20:17:24.785713+00	be23d0bf-1753-44c8-9a93-bbb1f8b0402f
5b20a326-1814-432b-8182-cd1456f013b0	5b20a326-1814-432b-8182-cd1456f013b0	{"sub": "5b20a326-1814-432b-8182-cd1456f013b0", "email": "fiscal4@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:17:37.608386+00	2026-03-11 20:17:37.608434+00	2026-03-11 20:17:37.608434+00	eaddbe30-0d2d-4c2e-bd6d-bf1546b315c6
787a91aa-779d-44af-8b07-77e0c5008411	787a91aa-779d-44af-8b07-77e0c5008411	{"sub": "787a91aa-779d-44af-8b07-77e0c5008411", "email": "expedicao2@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:18:09.506728+00	2026-03-11 20:18:09.506782+00	2026-03-11 20:18:09.506782+00	2e9d563e-b7d3-4ac7-84c1-e739ed640b58
ff4ff0a4-92eb-4f47-8923-c8c6403c4563	ff4ff0a4-92eb-4f47-8923-c8c6403c4563	{"sub": "ff4ff0a4-92eb-4f47-8923-c8c6403c4563", "email": "marketing2@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:18:39.96784+00	2026-03-11 20:18:39.967939+00	2026-03-11 20:18:39.967939+00	055fe531-841f-4c6e-9f9b-9b4c3e665d07
f473c268-d906-4f21-b199-341202544aa7	f473c268-d906-4f21-b199-341202544aa7	{"sub": "f473c268-d906-4f21-b199-341202544aa7", "email": "marketing3@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:18:50.708172+00	2026-03-11 20:18:50.708223+00	2026-03-11 20:18:50.708223+00	1277830a-1eee-43a0-91fd-6b513eff742c
71d4786b-929b-411b-9d08-81872996ccb2	71d4786b-929b-411b-9d08-81872996ccb2	{"sub": "71d4786b-929b-411b-9d08-81872996ccb2", "email": "admpmo1@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:19:11.391429+00	2026-03-11 20:19:11.391478+00	2026-03-11 20:19:11.391478+00	5f9e8c6b-8b3f-4b25-b892-51b3f6ac2e1e
d61602a7-e629-4c5c-b5f6-aa42b53179a5	d61602a7-e629-4c5c-b5f6-aa42b53179a5	{"sub": "d61602a7-e629-4c5c-b5f6-aa42b53179a5", "email": "logistica1@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:20:15.253323+00	2026-03-11 20:20:15.253373+00	2026-03-11 20:20:15.253373+00	18f3726b-693a-4cce-96b3-b6047872d976
b7c228b2-8124-4cbd-84c5-da7465724460	b7c228b2-8124-4cbd-84c5-da7465724460	{"sub": "b7c228b2-8124-4cbd-84c5-da7465724460", "email": "logistica2@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:21:26.848275+00	2026-03-11 20:21:26.848321+00	2026-03-11 20:21:26.848321+00	6f62d297-cc33-4311-aef6-6fe4105360ec
5cf33342-4b6c-43d4-b66e-35c87468359d	5cf33342-4b6c-43d4-b66e-35c87468359d	{"sub": "5cf33342-4b6c-43d4-b66e-35c87468359d", "email": "projetos4@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:22:07.667208+00	2026-03-11 20:22:07.667274+00	2026-03-11 20:22:07.667274+00	acb9d747-8fd4-4e1f-b9ba-ec2916d4ce9b
016031f8-9722-4d0f-a33d-d1f46aa862ed	016031f8-9722-4d0f-a33d-d1f46aa862ed	{"sub": "016031f8-9722-4d0f-a33d-d1f46aa862ed", "email": "rh.01@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:23:27.461069+00	2026-03-11 20:23:27.461119+00	2026-03-11 20:23:27.461119+00	9007d90d-5913-412c-a8be-f212a62953c6
b373450e-5aed-40eb-abcb-097412615ae5	b373450e-5aed-40eb-abcb-097412615ae5	{"sub": "b373450e-5aed-40eb-abcb-097412615ae5", "email": "rh.02@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:23:37.911579+00	2026-03-11 20:23:37.91163+00	2026-03-11 20:23:37.91163+00	d3334afc-5c97-4406-8063-f23f9094067e
a4277727-bdd8-48b5-94a0-72f5859b54b6	a4277727-bdd8-48b5-94a0-72f5859b54b6	{"sub": "a4277727-bdd8-48b5-94a0-72f5859b54b6", "email": "sistemas1@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:24:05.303867+00	2026-03-11 20:24:05.303919+00	2026-03-11 20:24:05.303919+00	e9ab37df-973d-4387-b718-89b096c71e99
e00a7127-207d-4d0e-b2b9-beb7a53dd5eb	e00a7127-207d-4d0e-b2b9-beb7a53dd5eb	{"sub": "e00a7127-207d-4d0e-b2b9-beb7a53dd5eb", "email": "sistemas2@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-11 20:24:23.723498+00	2026-03-11 20:24:23.723554+00	2026-03-11 20:24:23.723554+00	7a50ed08-459a-42f7-af55-5b102cbbb83b
576d0740-9374-479c-9073-579a096afdba	576d0740-9374-479c-9073-579a096afdba	{"sub": "576d0740-9374-479c-9073-579a096afdba", "email": "compras.01@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-19 12:26:15.936432+00	2026-03-19 12:26:15.936478+00	2026-03-19 12:26:15.936478+00	1001aa1c-22da-4d58-bd44-945cc51c1477
a698ccf9-5056-4893-95df-de4bedc95f6a	a698ccf9-5056-4893-95df-de4bedc95f6a	{"sub": "a698ccf9-5056-4893-95df-de4bedc95f6a", "email": "planejamento@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-23 19:18:34.310978+00	2026-03-23 19:18:34.311039+00	2026-03-23 19:18:34.311039+00	bb4ca479-0b2c-40e6-bfb0-ef0ff62b11dc
4ef1220e-ace5-41e5-a76c-6efa7b9b8b31	4ef1220e-ace5-41e5-a76c-6efa7b9b8b31	{"sub": "4ef1220e-ace5-41e5-a76c-6efa7b9b8b31", "email": "marketing@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-27 14:21:13.239094+00	2026-03-27 14:21:13.239149+00	2026-03-27 14:21:13.239149+00	764d90fd-ad02-4b7b-99ef-ba75e7458027
65cfd0a7-8326-4199-9c3a-bb8e32a2e434	65cfd0a7-8326-4199-9c3a-bb8e32a2e434	{"sub": "65cfd0a7-8326-4199-9c3a-bb8e32a2e434", "email": "nathan@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-31 13:43:14.263949+00	2026-03-31 13:43:14.264+00	2026-03-31 13:43:14.264+00	837c894d-24b2-4c4a-b5ba-23ad0ae6b7cc
e4daff41-5770-4b44-aced-fa836fc22f34	e4daff41-5770-4b44-aced-fa836fc22f34	{"sub": "e4daff41-5770-4b44-aced-fa836fc22f34", "email": "alex@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-03-31 13:43:40.710452+00	2026-03-31 13:43:40.710503+00	2026-03-31 13:43:40.710503+00	980ee514-9c70-4078-ad66-9c676d3221d5
0f74af5f-a4a6-4c9c-b9b4-5021fd8cf8b2	0f74af5f-a4a6-4c9c-b9b4-5021fd8cf8b2	{"sub": "0f74af5f-a4a6-4c9c-b9b4-5021fd8cf8b2", "email": "matheus.lopes@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-01 19:08:34.802003+00	2026-04-01 19:08:34.802064+00	2026-04-01 19:08:34.802064+00	1e9f3784-fee3-49d6-bc7a-5a49d14ee260
b97abada-6985-4b08-8166-0df9140a6a75	b97abada-6985-4b08-8166-0df9140a6a75	{"sub": "b97abada-6985-4b08-8166-0df9140a6a75", "email": "vinicius.arruda@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-01 19:10:51.969034+00	2026-04-01 19:10:51.969082+00	2026-04-01 19:10:51.969082+00	d795ae5a-7516-4abc-a8bb-46573201018f
df1d001d-ab08-4424-a07b-fa169576e1ba	df1d001d-ab08-4424-a07b-fa169576e1ba	{"sub": "df1d001d-ab08-4424-a07b-fa169576e1ba", "email": "projeto6@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:12.695249+00	2026-04-02 19:05:12.695302+00	2026-04-02 19:05:12.695302+00	e75bd83e-0720-41c7-ac88-0c5ac397c367
b626d259-e784-4be3-9472-6c84d3572f1c	b626d259-e784-4be3-9472-6c84d3572f1c	{"sub": "b626d259-e784-4be3-9472-6c84d3572f1c", "email": "expedicao@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:32.393485+00	2026-04-02 19:05:32.393533+00	2026-04-02 19:05:32.393533+00	f21c53c0-b050-4487-a7c4-c8aff4879236
008f38cf-1af6-40a5-ac92-657d3b15e14f	008f38cf-1af6-40a5-ac92-657d3b15e14f	{"sub": "008f38cf-1af6-40a5-ac92-657d3b15e14f", "email": "anapaula@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:32.889776+00	2026-04-02 19:05:32.889832+00	2026-04-02 19:05:32.889832+00	c26fe3e6-c803-455c-a1ae-fb74f4e48745
708e0503-f2a8-4024-812a-0a3068ed5e8b	708e0503-f2a8-4024-812a-0a3068ed5e8b	{"sub": "708e0503-f2a8-4024-812a-0a3068ed5e8b", "email": "atendimento.01@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:33.380464+00	2026-04-02 19:05:33.38051+00	2026-04-02 19:05:33.38051+00	42222cde-5c68-436a-9504-542f152f7f9f
e021c120-1c8d-490d-8407-166b57d8ebce	e021c120-1c8d-490d-8407-166b57d8ebce	{"sub": "e021c120-1c8d-490d-8407-166b57d8ebce", "email": "projeto5@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:33.868609+00	2026-04-02 19:05:33.868668+00	2026-04-02 19:05:33.868668+00	4447a3e6-6d73-45ac-9c36-23eb3b53e690
f80aa976-1598-4b60-a6ca-9d63458d0a5f	f80aa976-1598-4b60-a6ca-9d63458d0a5f	{"sub": "f80aa976-1598-4b60-a6ca-9d63458d0a5f", "email": "projeto7@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:34.361878+00	2026-04-02 19:05:34.361933+00	2026-04-02 19:05:34.361933+00	38e6705a-f75f-44ac-bb7e-9c1054491869
0c9b48b4-4b98-4fdd-88c4-db7f29ca95bf	0c9b48b4-4b98-4fdd-88c4-db7f29ca95bf	{"sub": "0c9b48b4-4b98-4fdd-88c4-db7f29ca95bf", "email": "projetos8@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:34.854612+00	2026-04-02 19:05:34.854662+00	2026-04-02 19:05:34.854662+00	b4d5c089-3e94-4dcc-b062-901728e358e1
b7ceff48-923f-4e61-ae71-deee2f8b4b9b	b7ceff48-923f-4e61-ae71-deee2f8b4b9b	{"sub": "b7ceff48-923f-4e61-ae71-deee2f8b4b9b", "email": "rh.03@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:35.354714+00	2026-04-02 19:05:35.354769+00	2026-04-02 19:05:35.354769+00	ae056287-3776-4cc6-896a-49410b836ffe
cdb34c89-a56b-44f9-a906-fe07a8c782d8	cdb34c89-a56b-44f9-a906-fe07a8c782d8	{"sub": "cdb34c89-a56b-44f9-a906-fe07a8c782d8", "email": "cristian@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:35.863135+00	2026-04-02 19:05:35.863182+00	2026-04-02 19:05:35.863182+00	183295e3-54ca-452b-9cdd-600480d9d849
ee31cc52-11d4-4477-afda-571b9acb2f83	ee31cc52-11d4-4477-afda-571b9acb2f83	{"sub": "ee31cc52-11d4-4477-afda-571b9acb2f83", "email": "davi@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:36.351474+00	2026-04-02 19:05:36.351528+00	2026-04-02 19:05:36.351528+00	fa4ba62d-9bbb-4471-9d94-cb306901a8bc
6da1834b-6fd9-493f-87a7-d3ae4a90fb22	6da1834b-6fd9-493f-87a7-d3ae4a90fb22	{"sub": "6da1834b-6fd9-493f-87a7-d3ae4a90fb22", "email": "fabio@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:36.834653+00	2026-04-02 19:05:36.834703+00	2026-04-02 19:05:36.834703+00	58e814a6-c5d6-468f-9c2b-e2ff91417511
6028ba2b-3fcc-4be4-8c12-0d085b16a21f	6028ba2b-3fcc-4be4-8c12-0d085b16a21f	{"sub": "6028ba2b-3fcc-4be4-8c12-0d085b16a21f", "email": "obras@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:37.334393+00	2026-04-02 19:05:37.334449+00	2026-04-02 19:05:37.334449+00	653bec82-51b9-4372-9533-5a45a049f176
fbb20dbe-6c2f-45ce-804b-abf8aed6ee30	fbb20dbe-6c2f-45ce-804b-abf8aed6ee30	{"sub": "fbb20dbe-6c2f-45ce-804b-abf8aed6ee30", "email": "felipe.lessa@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:37.820133+00	2026-04-02 19:05:37.820182+00	2026-04-02 19:05:37.820182+00	06d28b59-99bb-4810-a070-593dde26d752
6c198a4e-a9b3-450c-84a3-95a74823db70	6c198a4e-a9b3-450c-84a3-95a74823db70	{"sub": "6c198a4e-a9b3-450c-84a3-95a74823db70", "email": "projeto9@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:38.30641+00	2026-04-02 19:05:38.30646+00	2026-04-02 19:05:38.30646+00	f01a2934-d11c-4ab0-b0dd-da238b1f5ddb
48af8a7e-96ed-4dec-ba5e-482b41be4361	48af8a7e-96ed-4dec-ba5e-482b41be4361	{"sub": "48af8a7e-96ed-4dec-ba5e-482b41be4361", "email": "projeto2@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:38.80545+00	2026-04-02 19:05:38.805497+00	2026-04-02 19:05:38.805497+00	80c33e93-9981-42f6-9245-000a7193e1fd
2c3ffe1a-1a00-457d-9820-1af0660f3715	2c3ffe1a-1a00-457d-9820-1af0660f3715	{"sub": "2c3ffe1a-1a00-457d-9820-1af0660f3715", "email": "gilvan@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:39.291294+00	2026-04-02 19:05:39.291341+00	2026-04-02 19:05:39.291341+00	da2b8318-4c8d-4e21-93be-a2d1c7b7c25f
1b73b493-4c45-41c5-9cf9-bd101f5fcb74	1b73b493-4c45-41c5-9cf9-bd101f5fcb74	{"sub": "1b73b493-4c45-41c5-9cf9-bd101f5fcb74", "email": "guilherme@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:39.786846+00	2026-04-02 19:05:39.786894+00	2026-04-02 19:05:39.786894+00	ab707ad6-1ceb-46ab-9925-4db700802a5b
4057a41d-e43f-49ed-911c-4f551e6bd9d0	4057a41d-e43f-49ed-911c-4f551e6bd9d0	{"sub": "4057a41d-e43f-49ed-911c-4f551e6bd9d0", "email": "projeto10@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:40.278686+00	2026-04-02 19:05:40.278734+00	2026-04-02 19:05:40.278734+00	58e9b4da-7a9a-4731-8f5b-cc65eec8c77f
dd0d676b-12f5-4e55-895e-6b31e26af81e	dd0d676b-12f5-4e55-895e-6b31e26af81e	{"sub": "dd0d676b-12f5-4e55-895e-6b31e26af81e", "email": "projeto1@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:40.783418+00	2026-04-02 19:05:40.783465+00	2026-04-02 19:05:40.783465+00	1c31f14e-bf3e-4b80-b110-f94f7451e191
66654dde-4a91-416b-b4df-c7fe19a3e883	66654dde-4a91-416b-b4df-c7fe19a3e883	{"sub": "66654dde-4a91-416b-b4df-c7fe19a3e883", "email": "financeiro@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:41.281835+00	2026-04-02 19:05:41.2819+00	2026-04-02 19:05:41.2819+00	a699b1d3-ff26-48db-9507-2336875437f5
e7fbc22c-5bd9-4e26-8652-1d9c6dbf12c9	e7fbc22c-5bd9-4e26-8652-1d9c6dbf12c9	{"sub": "e7fbc22c-5bd9-4e26-8652-1d9c6dbf12c9", "email": "karla@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:41.771297+00	2026-04-02 19:05:41.771354+00	2026-04-02 19:05:41.771354+00	bd1f8a61-a43c-4393-9cd7-d59e6c1b57fc
917316ea-c6f0-4b7b-bcc4-c64feb11379a	917316ea-c6f0-4b7b-bcc4-c64feb11379a	{"sub": "917316ea-c6f0-4b7b-bcc4-c64feb11379a", "email": "assistente.marcenaria@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:42.262909+00	2026-04-02 19:05:42.262997+00	2026-04-02 19:05:42.262997+00	b0f37e96-9362-4459-8791-9a6c4ea6503d
8a29beb1-2165-4a2e-9271-0a31c8113db8	8a29beb1-2165-4a2e-9271-0a31c8113db8	{"sub": "8a29beb1-2165-4a2e-9271-0a31c8113db8", "email": "murilo@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:42.746327+00	2026-04-02 19:05:42.746379+00	2026-04-02 19:05:42.746379+00	3905f246-4c0f-4f6a-95d3-728d2cf1a1e5
6893df91-b552-40df-9722-4c95e23e5df8	6893df91-b552-40df-9722-4c95e23e5df8	{"sub": "6893df91-b552-40df-9722-4c95e23e5df8", "email": "pcp@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:43.259999+00	2026-04-02 19:05:43.260049+00	2026-04-02 19:05:43.260049+00	ceb40770-971b-4892-bca8-40e811ae38ee
357569e3-5ebc-4295-ad34-13a2014bdf0b	357569e3-5ebc-4295-ad34-13a2014bdf0b	{"sub": "357569e3-5ebc-4295-ad34-13a2014bdf0b", "email": "raniere@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:43.751413+00	2026-04-02 19:05:43.751468+00	2026-04-02 19:05:43.751468+00	7208a7a4-0315-4e02-bb75-37539903695f
2ef2ea49-e507-458d-9124-bc05a75c57e7	2ef2ea49-e507-458d-9124-bc05a75c57e7	{"sub": "2ef2ea49-e507-458d-9124-bc05a75c57e7", "email": "fiscal01@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:44.24915+00	2026-04-02 19:05:44.249202+00	2026-04-02 19:05:44.249202+00	634a800a-fcd5-4877-8b9f-35ffcb40036e
a15fc367-4eaa-47c7-bc5f-dcb8909e004d	a15fc367-4eaa-47c7-bc5f-dcb8909e004d	{"sub": "a15fc367-4eaa-47c7-bc5f-dcb8909e004d", "email": "sueli@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:44.777884+00	2026-04-02 19:05:44.777933+00	2026-04-02 19:05:44.777933+00	9e35ceda-2364-486b-a534-1d90ffe2ce8c
45cd376c-e0b4-4fd4-a156-7332b4f28dab	45cd376c-e0b4-4fd4-a156-7332b4f28dab	{"sub": "45cd376c-e0b4-4fd4-a156-7332b4f28dab", "email": "compras@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:45.283434+00	2026-04-02 19:05:45.283485+00	2026-04-02 19:05:45.283485+00	fc15de8a-5be4-4a66-af17-de46e85563fc
822796ab-5acd-4c23-aa1c-b2e960420413	822796ab-5acd-4c23-aa1c-b2e960420413	{"sub": "822796ab-5acd-4c23-aa1c-b2e960420413", "email": "projeto3@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:45.779676+00	2026-04-02 19:05:45.779725+00	2026-04-02 19:05:45.779725+00	16ff0dae-de70-4b47-837c-bce117437a81
02c64bf6-3d41-4ad9-bed8-820843816230	02c64bf6-3d41-4ad9-bed8-820843816230	{"sub": "02c64bf6-3d41-4ad9-bed8-820843816230", "email": "projeto4@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:46.281528+00	2026-04-02 19:05:46.28158+00	2026-04-02 19:05:46.28158+00	a0fa7bd6-4fae-4576-ac42-ca4ca6e3e70a
15686346-f8ea-42ad-aeae-8666b7021ad0	15686346-f8ea-42ad-aeae-8666b7021ad0	{"sub": "15686346-f8ea-42ad-aeae-8666b7021ad0", "email": "will@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:46.772863+00	2026-04-02 19:05:46.772911+00	2026-04-02 19:05:46.772911+00	00847c6b-dcf6-49a3-bb99-01258955657c
f090d5e9-a677-41b5-a764-4c56d0dc2a7a	f090d5e9-a677-41b5-a764-4c56d0dc2a7a	{"sub": "f090d5e9-a677-41b5-a764-4c56d0dc2a7a", "email": "gustavo@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:47.251752+00	2026-04-02 19:05:47.251805+00	2026-04-02 19:05:47.251805+00	ae2e8eed-e427-4a0d-92de-5d26f093849a
52517f1b-2361-439c-9481-b56f92d9866e	52517f1b-2361-439c-9481-b56f92d9866e	{"sub": "52517f1b-2361-439c-9481-b56f92d9866e", "email": "contratos@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:47.733036+00	2026-04-02 19:05:47.733089+00	2026-04-02 19:05:47.733089+00	e8c053ad-0c4c-4ed2-9ae7-1ec6088a4cdc
f0647ffa-a8df-4ba3-9d37-49b54f5395ee	f0647ffa-a8df-4ba3-9d37-49b54f5395ee	{"sub": "f0647ffa-a8df-4ba3-9d37-49b54f5395ee", "email": "marina@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-02 19:05:48.235198+00	2026-04-02 19:05:48.23526+00	2026-04-02 19:05:48.23526+00	14213f5f-f0d9-410c-944d-e31623d8af71
1074978b-504e-49d2-b559-8bda7af8085e	1074978b-504e-49d2-b559-8bda7af8085e	{"sub": "1074978b-504e-49d2-b559-8bda7af8085e", "email": "admin@injexia.com", "email_verified": false, "phone_verified": false}	email	2026-04-06 23:25:33.143989+00	2026-04-06 23:25:33.144034+00	2026-04-06 23:25:33.144034+00	ff008ccd-fe4b-49d2-8a6b-47935d99c88d
0410679e-c89c-48d9-b314-ec9a174317fe	0410679e-c89c-48d9-b314-ec9a174317fe	{"sub": "0410679e-c89c-48d9-b314-ec9a174317fe", "email": "will.tape@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-04-06 23:59:13.120499+00	2026-04-06 23:59:13.120548+00	2026-04-06 23:59:13.120548+00	0723bb8d-0f50-488b-b092-1f547223c17a
6cb6c215-f16e-4ef6-b1ed-e4a203b3570a	6cb6c215-f16e-4ef6-b1ed-e4a203b3570a	{"sub": "6cb6c215-f16e-4ef6-b1ed-e4a203b3570a", "email": "admin02@injexia.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-07 00:22:23.117794+00	2026-04-07 00:22:23.117838+00	2026-04-07 00:22:23.117838+00	a8472095-0edd-4971-a041-1ea928396480
1b13d372-cf85-4da7-8e77-8d5012314348	1b13d372-cf85-4da7-8e77-8d5012314348	{"sub": "1b13d372-cf85-4da7-8e77-8d5012314348", "email": "douglas2@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-07 16:16:59.188914+00	2026-04-07 16:16:59.188962+00	2026-04-07 16:16:59.188962+00	84014e5e-5c7e-4ea4-bd61-0022395f74bc
ac010407-4d32-4909-9a35-5b2c1cb847bb	ac010407-4d32-4909-9a35-5b2c1cb847bb	{"sub": "ac010407-4d32-4909-9a35-5b2c1cb847bb", "email": "douglas@injexia.com", "email_verified": false, "phone_verified": false}	email	2026-04-07 17:46:26.123643+00	2026-04-07 17:46:26.123694+00	2026-04-07 17:46:26.123694+00	a22ae4d6-cf87-4ab4-b407-4b907d724e7e
51570c7c-32e1-43db-abf5-4ee22512641c	51570c7c-32e1-43db-abf5-4ee22512641c	{"sub": "51570c7c-32e1-43db-abf5-4ee22512641c", "email": "juniorartevisual@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-04-07 19:35:25.308332+00	2026-04-07 19:35:25.308377+00	2026-04-07 19:35:25.308377+00	5b57ac32-8baa-44b4-bf07-2c8971e8dc53
6838b1c7-c1ce-4da8-bff2-03b70b14954b	6838b1c7-c1ce-4da8-bff2-03b70b14954b	{"sub": "6838b1c7-c1ce-4da8-bff2-03b70b14954b", "email": "bielvict269@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-04-09 17:54:36.30662+00	2026-04-09 17:54:36.306665+00	2026-04-09 17:54:36.306665+00	84955bc1-804c-42af-b514-5d915ad8bcd3
0c351d18-2776-40b4-873a-253a1ba42606	0c351d18-2776-40b4-873a-253a1ba42606	{"sub": "0c351d18-2776-40b4-873a-253a1ba42606", "email": "willabc@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-04-10 16:16:02.06819+00	2026-04-10 16:16:02.06825+00	2026-04-10 16:16:02.06825+00	58375e0c-26b2-49e4-9def-8700c0b9092a
b3ba1a3f-c7a7-4b31-996e-8a72293fa54c	b3ba1a3f-c7a7-4b31-996e-8a72293fa54c	{"sub": "b3ba1a3f-c7a7-4b31-996e-8a72293fa54c", "email": "will2@gmail.com", "email_verified": false, "phone_verified": false}	email	2026-04-11 17:32:35.976696+00	2026-04-11 17:32:35.976745+00	2026-04-11 17:32:35.976745+00	aa144983-7317-44b8-a3d7-0c20a1ec03a8
fc0ee353-1c2d-4ebe-b6fb-4a2be8d677b8	fc0ee353-1c2d-4ebe-b6fb-4a2be8d677b8	{"sub": "fc0ee353-1c2d-4ebe-b6fb-4a2be8d677b8", "email": "danyele@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-15 19:43:50.288246+00	2026-04-15 19:43:50.288296+00	2026-04-15 19:43:50.288296+00	1e6240d7-34cb-4075-b045-789371ea5127
73dd2983-7f59-485d-a69b-1d1fc30adb4d	73dd2983-7f59-485d-a69b-1d1fc30adb4d	{"sub": "73dd2983-7f59-485d-a69b-1d1fc30adb4d", "email": "thayna.orcamento@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-04-27 13:16:17.464274+00	2026-04-27 13:16:17.464328+00	2026-04-27 13:16:17.464328+00	fdd15e32-5644-4d9b-b9b0-083790a24e36
502a7b87-2275-4cc3-aadf-6bd5df105717	502a7b87-2275-4cc3-aadf-6bd5df105717	{"sub": "502a7b87-2275-4cc3-aadf-6bd5df105717", "email": "rafael.calazans@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-05-11 12:17:40.957648+00	2026-05-11 12:17:40.957707+00	2026-05-11 12:17:40.957707+00	fa4ab81c-c553-4eeb-88f1-4c6b533d9bb2
4601f488-e360-4879-8e50-b7b194bdf642	4601f488-e360-4879-8e50-b7b194bdf642	{"sub": "4601f488-e360-4879-8e50-b7b194bdf642", "email": "alvaro@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-05-15 16:46:24.406313+00	2026-05-15 16:46:24.406373+00	2026-05-15 16:46:24.406373+00	04913638-5e43-4682-8eda-d467a1e9455e
ecf89521-35fe-4134-b5c0-8329de87dea2	ecf89521-35fe-4134-b5c0-8329de87dea2	{"sub": "ecf89521-35fe-4134-b5c0-8329de87dea2", "email": "cristiano@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-05-22 15:20:34.957365+00	2026-05-22 15:20:34.957419+00	2026-05-22 15:20:34.957419+00	30416bf9-cbb1-43e1-9dd5-b0e77b67a75b
9b3e5e1b-8fc1-4383-886a-b12d6143e1e3	9b3e5e1b-8fc1-4383-886a-b12d6143e1e3	{"sub": "9b3e5e1b-8fc1-4383-886a-b12d6143e1e3", "email": "davi.fiscal@parket.com.br", "email_verified": false, "phone_verified": false}	email	2026-05-22 16:07:17.383874+00	2026-05-22 16:07:17.383931+00	2026-05-22 16:07:17.383931+00	88a14a0a-6d29-46b1-9c4b-93bf4b0c350d
687de092-044b-4513-bfe4-97e15189d55c	687de092-044b-4513-bfe4-97e15189d55c	{"sub": "687de092-044b-4513-bfe4-97e15189d55c", "email": "claudetest3@parket.local", "email_verified": false, "phone_verified": false}	email	2026-05-26 13:49:19.35983+00	2026-05-26 13:49:19.359886+00	2026-05-26 13:49:19.359886+00	a4eb1add-754e-4364-b6d1-7ab1df8355f2
\.


ALTER TABLE auth.identities ENABLE TRIGGER ALL;

--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.instances DISABLE TRIGGER ALL;

COPY auth.instances (id, uuid, raw_base_config, created_at, updated_at) FROM stdin;
\.


ALTER TABLE auth.instances ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.oauth_clients DISABLE TRIGGER ALL;

COPY auth.oauth_clients (id, client_secret_hash, registration_type, redirect_uris, grant_types, client_name, client_uri, logo_uri, created_at, updated_at, deleted_at, client_type, token_endpoint_auth_method) FROM stdin;
\.


ALTER TABLE auth.oauth_clients ENABLE TRIGGER ALL;

--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions DISABLE TRIGGER ALL;

COPY auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after, refreshed_at, user_agent, ip, tag, oauth_client_id, refresh_token_hmac_key, refresh_token_counter, scopes) FROM stdin;
\.


ALTER TABLE auth.sessions ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims DISABLE TRIGGER ALL;

COPY auth.mfa_amr_claims (session_id, created_at, updated_at, authentication_method, id) FROM stdin;
\.


ALTER TABLE auth.mfa_amr_claims ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors DISABLE TRIGGER ALL;

COPY auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret, phone, last_challenged_at, web_authn_credential, web_authn_aaguid, last_webauthn_challenge_data) FROM stdin;
\.


ALTER TABLE auth.mfa_factors ENABLE TRIGGER ALL;

--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges DISABLE TRIGGER ALL;

COPY auth.mfa_challenges (id, factor_id, created_at, verified_at, ip_address, otp_code, web_authn_session_data) FROM stdin;
\.


ALTER TABLE auth.mfa_challenges ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.oauth_authorizations DISABLE TRIGGER ALL;

COPY auth.oauth_authorizations (id, authorization_id, client_id, user_id, redirect_uri, scope, state, resource, code_challenge, code_challenge_method, response_type, status, authorization_code, created_at, expires_at, approved_at, nonce) FROM stdin;
\.


ALTER TABLE auth.oauth_authorizations ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.oauth_client_states DISABLE TRIGGER ALL;

COPY auth.oauth_client_states (id, provider_type, code_verifier, created_at) FROM stdin;
\.


ALTER TABLE auth.oauth_client_states ENABLE TRIGGER ALL;

--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.oauth_consents DISABLE TRIGGER ALL;

COPY auth.oauth_consents (id, user_id, client_id, scopes, granted_at, revoked_at) FROM stdin;
\.


ALTER TABLE auth.oauth_consents ENABLE TRIGGER ALL;

--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens DISABLE TRIGGER ALL;

COPY auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at) FROM stdin;
\.


ALTER TABLE auth.one_time_tokens ENABLE TRIGGER ALL;

--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens DISABLE TRIGGER ALL;

COPY auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id) FROM stdin;
\.


ALTER TABLE auth.refresh_tokens ENABLE TRIGGER ALL;

--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers DISABLE TRIGGER ALL;

COPY auth.sso_providers (id, resource_id, created_at, updated_at, disabled) FROM stdin;
\.


ALTER TABLE auth.sso_providers ENABLE TRIGGER ALL;

--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers DISABLE TRIGGER ALL;

COPY auth.saml_providers (id, sso_provider_id, entity_id, metadata_xml, metadata_url, attribute_mapping, created_at, updated_at, name_id_format) FROM stdin;
\.


ALTER TABLE auth.saml_providers ENABLE TRIGGER ALL;

--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states DISABLE TRIGGER ALL;

COPY auth.saml_relay_states (id, sso_provider_id, request_id, for_email, redirect_to, created_at, updated_at, flow_state_id) FROM stdin;
\.


ALTER TABLE auth.saml_relay_states ENABLE TRIGGER ALL;

--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations DISABLE TRIGGER ALL;

COPY auth.schema_migrations (version) FROM stdin;
20171026211738
20171026211808
20171026211834
20180103212743
20180108183307
20180119214651
20180125194653
00
20210710035447
20210722035447
20210730183235
20210909172000
20210927181326
20211122151130
20211124214934
20211202183645
20220114185221
20220114185340
20220224000811
20220323170000
20220429102000
20220531120530
20220614074223
20220811173540
20221003041349
20221003041400
20221011041400
20221020193600
20221021073300
20221021082433
20221027105023
20221114143122
20221114143410
20221125140132
20221208132122
20221215195500
20221215195800
20221215195900
20230116124310
20230116124412
20230131181311
20230322519590
20230402418590
20230411005111
20230508135423
20230523124323
20230818113222
20230914180801
20231027141322
20231114161723
20231117164230
20240115144230
20240214120130
20240306115329
20240314092811
20240427152123
20240612123726
20240729123726
20240802193726
20240806073726
20241009103726
20250717082212
20250731150234
20250804100000
20250901200500
20250903112500
20250904133000
20250925093508
20251007112900
20251104100000
20251111201300
20251201000000
20260115000000
20260121000000
20260219120000
20260302000000
\.


ALTER TABLE auth.schema_migrations ENABLE TRIGGER ALL;

--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains DISABLE TRIGGER ALL;

COPY auth.sso_domains (id, sso_provider_id, domain, created_at, updated_at) FROM stdin;
\.


ALTER TABLE auth.sso_domains ENABLE TRIGGER ALL;

--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.webauthn_challenges DISABLE TRIGGER ALL;

COPY auth.webauthn_challenges (id, user_id, challenge_type, session_data, created_at, expires_at) FROM stdin;
\.


ALTER TABLE auth.webauthn_challenges ENABLE TRIGGER ALL;

--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: -
--

ALTER TABLE auth.webauthn_credentials DISABLE TRIGGER ALL;

COPY auth.webauthn_credentials (id, user_id, credential_id, public_key, attestation_type, aaguid, sign_count, transports, backup_eligible, backed_up, friendly_name, created_at, updated_at, last_used_at) FROM stdin;
\.


ALTER TABLE auth.webauthn_credentials ENABLE TRIGGER ALL;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: -
--

SELECT pg_catalog.setval('auth.refresh_tokens_id_seq', 4046, true);


--
-- PostgreSQL database dump complete
--

\unrestrict wgGMsHWyLoetyf1HPU0jbo4wgg3fhNWrAaiRbhMxPHsTEeVCrZ8gDDjk0oyilCr

