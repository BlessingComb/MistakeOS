-- LOCAL/DRAFT academic catalog extracted only from Annex 1 of the approved source.
-- Source: Edital 14 de 2026 [Consolidado], PSC 2027, 2nd Stage, Project 2028.
-- The consolidated document already incorporates Rectification 01, which changes
-- application locations only and does not alter Annex 1.

insert into public.academic_subjects(code,name_pt_br,name_en,legacy_subject_id,display_order) values
  ('portuguese_literature','Língua Portuguesa e Literatura','Língua Portuguesa e Literatura','languages',10),
  ('history','História','História','other',20),
  ('geography','Geografia','Geografia','other',30),
  ('biology','Biologia','Biologia','biology',40),
  ('chemistry','Química','Química','chemistry',50),
  ('physics','Física','Física','physics',60),
  ('mathematics','Matemática','Matemática','mathematics',70)
on conflict (code) do nothing;

insert into public.exam_programs(code,institution,name) values
  ('psc','Universidade Federal do Amazonas — UFAM','Processo Seletivo Contínuo — PSC')
on conflict (code) do nothing;

insert into public.exam_catalog_versions(
  id,program_code,stage,cycle,exam_year,project_year,source_url,source_year,
  source_document,document_version,catalog_version,status,imported_at,published_at
) values (
  '27000000-0000-4000-8000-000000000002','psc','2ª Etapa','Projeto 2028',2027,2028,
  'https://edoc.ufam.edu.br/handle/123456789/12242',2026,
  'Edital 14 de 2026 [Consolidado]','Consolidado com a Retificação nº 01 aplicada',
  'psc-2027-stage-2-project-2028-v1','draft',now(),null
);

create temporary table psc2_catalog_import(
  code text primary key, subject_code text not null, label text not null,
  source_locator text not null, display_order integer not null
) on commit drop;

insert into psc2_catalog_import(code,subject_code,label,source_locator,display_order) values
  ('language.argumentative-text.cohesion','portuguese_literature','Texto dissertativo-argumentativo e elementos coesivos','Anexo 1, p. 16 — Língua Portuguesa e Literatura',101),
  ('language.agreement-and-government','portuguese_literature','Concordância e regência verbal e nominal','Anexo 1, p. 16 — Língua Portuguesa e Literatura',102),
  ('language.digital-posts-news-memes','portuguese_literature','Postagens, notícias e memes','Anexo 1, p. 16 — Língua Portuguesa e Literatura',103),
  ('language.fact-and-opinion','portuguese_literature','Fato e opinião','Anexo 1, p. 16 — Língua Portuguesa e Literatura',104),
  ('language.journalistic-texts','portuguese_literature','Textos jornalísticos','Anexo 1, p. 16 — Língua Portuguesa e Literatura',105),
  ('literature.parnassian-poetry-hatoum-songs','portuguese_literature','Poesia parnasiana, contos de Milton Hatoum e canções','Anexo 1, p. 16 — Língua Portuguesa e Literatura',106),
  ('literature.parnassian-poetry-analysis','portuguese_literature','Análise da poesia parnasiana','Anexo 1, p. 16 — Língua Portuguesa e Literatura',107),
  ('language.genre.statute','portuguese_literature','Gênero: estatuto','Anexo 1, p. 16 — Língua Portuguesa e Literatura',108),
  ('language.genre.fanfic-fanclips','portuguese_literature','Gênero: fanfic e fanclipes','Anexo 1, p. 16 — Língua Portuguesa e Literatura',109),
  ('language.verbal-voices-indeterminate-subject','portuguese_literature','Vozes verbais e índice de indeterminação do sujeito','Anexo 1, p. 16 — Língua Portuguesa e Literatura',110),
  ('language.punctuation.comma','portuguese_literature','Pontuação: uso de vírgula','Anexo 1, p. 16 — Língua Portuguesa e Literatura',111),
  ('language.genre.chronicle','portuguese_literature','Gênero: crônica','Anexo 1, p. 16 — Língua Portuguesa e Literatura',112),
  ('language.genre.questionnaire','portuguese_literature','Gênero: questionário','Anexo 1, p. 16 — Língua Portuguesa e Literatura',113),
  ('language.professions-occupations','portuguese_literature','Profissões e ocupações','Anexo 1, p. 16 — Língua Portuguesa e Literatura',114),
  ('language.mixed-language-genres','portuguese_literature','Gêneros de linguagem mista: quadro, tabela e gráficos','Anexo 1, p. 16 — Língua Portuguesa e Literatura',115),
  ('language.genre.seminar-report','portuguese_literature','Gênero: seminário e relatório','Anexo 1, p. 16 — Língua Portuguesa e Literatura',116),
  ('literature.realism-naturalism','portuguese_literature','Realismo e Naturalismo','Anexo 1, p. 16 — Língua Portuguesa e Literatura',117),
  ('literature.realist-universal-themes','portuguese_literature','Temáticas universais, rupturas e permanências na literatura realista brasileira e portuguesa','Anexo 1, p. 16 — Língua Portuguesa e Literatura',118),
  ('language.genre.literary-podcast','portuguese_literature','Gênero: podcast literário','Anexo 1, p. 16 — Língua Portuguesa e Literatura',119),
  ('literature.portuguese-indigenous-african-latin-american','portuguese_literature','Literatura portuguesa, indígena, africana e latino-americana','Anexo 1, p. 16 — Língua Portuguesa e Literatura',120),
  ('language.pronominal-placement','portuguese_literature','Colocação pronominal','Anexo 1, p. 16 — Língua Portuguesa e Literatura',121),
  ('language.crasis','portuguese_literature','Crase','Anexo 1, p. 16 — Língua Portuguesa e Literatura',122),
  ('language.genre.comics-fanzines','portuguese_literature','Gênero: quadrinhos e fanzines','Anexo 1, p. 16 — Língua Portuguesa e Literatura',123),
  ('language.information-bubbles-post-truth','portuguese_literature','Bolhas informacionais e pós-verdade','Anexo 1, p. 16 — Língua Portuguesa e Literatura',124),
  ('language.political-discourse-propaganda','portuguese_literature','Discurso e propaganda política','Anexo 1, p. 16 — Língua Portuguesa e Literatura',125),
  ('language.digital-genre.feed','portuguese_literature','Gênero digital: feed','Anexo 1, p. 16 — Língua Portuguesa e Literatura',126),
  ('language.digital-advertising-text','portuguese_literature','Texto publicitário em contexto digital','Anexo 1, p. 16 — Língua Portuguesa e Literatura',127),
  ('language.textual-coherence','portuguese_literature','Coerência textual','Anexo 1, p. 16 — Língua Portuguesa e Literatura',128),
  ('language.relative-pronouns-integral-conjunction','portuguese_literature','Pronomes relativos e conjunção integrante','Anexo 1, p. 16 — Língua Portuguesa e Literatura',129),
  ('language.simple-period-syntax','portuguese_literature','Sintaxe do período simples','Anexo 1, p. 16 — Língua Portuguesa e Literatura',130),
  ('language.independent-journalism','portuguese_literature','Jornalismo independente','Anexo 1, p. 16 — Língua Portuguesa e Literatura',131),
  ('language.authorial-choices-meaning-effects','portuguese_literature','Efeitos de sentido provocados pelas escolhas realizadas pelo autor','Anexo 1, p. 16 — Língua Portuguesa e Literatura',132),
  ('language.genre.infographic','portuguese_literature','Gênero: infográfico','Anexo 1, p. 16 — Língua Portuguesa e Literatura',133),
  ('literature.marginal-peripheral','portuguese_literature','Literatura marginal e de periferia','Anexo 1, p. 16 — Língua Portuguesa e Literatura',134),
  ('literature.work.the-island-city','portuguese_literature','Obra literária: A cidade ilhada, Milton Hatoum','Anexo 1, p. 16 — Língua Portuguesa e Literatura',135),

  ('history.americas-colonization','history','Colonização da América espanhola e portuguesa: objetivos, estratégias e consequências','Anexo 1, p. 16 — História',201),
  ('history.european-colonial-models','history','Diferentes modelos coloniais europeus e seus efeitos sociais e culturais','Anexo 1, p. 16 — História',202),
  ('history.mercantilism-colonial-system','history','Sistema colonial e mercantilismo: economia, exploração e acumulação','Anexo 1, p. 16 — História',203),
  ('history.colonial-social-political-organization','history','Organização social e política nas colônias','Anexo 1, p. 16 — História',204),
  ('history.colonial-economy-european-development','history','Economia colonial, desenvolvimento europeu e interesses dos grupos no poder','Anexo 1, p. 16 — História',205),
  ('history.african-indigenous-enslavement','history','Escravização africana e indígena nas Américas','Anexo 1, p. 16 — História',206),
  ('history.colonial-resistance-solidarity','history','Enfrentamento, adaptações culturais e redes de solidariedade diante da opressão colonial','Anexo 1, p. 16 — História',207),
  ('history.atlantic-slave-trade-diaspora','history','Tráfico atlântico e diáspora africana: agentes e impactos socioculturais','Anexo 1, p. 16 — História',208),
  ('history.africa-brazil-productive-system','history','Africanos e afrodescendentes como agentes do sistema produtivo na América Portuguesa','Anexo 1, p. 16 — História',209),
  ('history.colonial-amazon-presence','history','Presença colonial na Amazônia','Anexo 1, p. 16 — História',210),
  ('history.amazon-conquest-xvi-xviii','history','Conquista da Amazônia (XVI–XVIII): administração, exploração, dominação e políticas indigenistas','Anexo 1, p. 16 — História',211),
  ('history.church-in-amazon','history','Igreja na Amazônia: hegemonia missionária, clero secular e atuação inquisitorial','Anexo 1, p. 16 — História',212),
  ('history.pombaline-period-directory-indians','history','Período Pombalino no Amazonas e Diretório dos Índios','Anexo 1, p. 16 — História',213),
  ('history.amazon-colonial-disputes-treaties','history','Amazônia nas disputas coloniais e impactos dos Tratados de Madri e Santo Ildefonso','Anexo 1, p. 16 — História',214),
  ('history.colonization-environmental-impacts','history','Impactos ambientais do processo de colonização','Anexo 1, p. 16 — História',215),
  ('history.indigenous-societies-good-living','history','Sociedades indígenas e o Bem Viver','Anexo 1, p. 16 — História',216),
  ('history.colonial-society-gender','history','Sociedade colonial e gênero','Anexo 1, p. 16 — História',217),
  ('history.women-resistance-agency-erasure','history','Mulheres indígenas, africanas e europeias: resistência, agência e apagamento histórico','Anexo 1, p. 16 — História',218),
  ('history.absolutism-enlightenment','history','Absolutismo e Iluminismo e seus impactos na estrutura colonial americana','Anexo 1, p. 17 — História',219),
  ('history.enlightenment-contradictions','history','Iluminismo e suas contradições','Anexo 1, p. 17 — História',220),
  ('history.bourgeois-revolutions','history','Revoluções burguesas Inglesa, Francesa e Industrial','Anexo 1, p. 17 — História',221),
  ('history.americas-revolutions-independence','history','Revoluções e independências nas Américas','Anexo 1, p. 17 — História',222),
  ('history.brazilian-empire-first-regency','history','Império brasileiro: Primeiro Reinado e Período Regencial','Anexo 1, p. 17 — História',223),
  ('history.black-indigenous-resistance','history','Resistência negra e indígena nas Américas','Anexo 1, p. 17 — História',224),
  ('history.women-revolutions-independence','history','Mulheres nas revoluções e nos processos de independência','Anexo 1, p. 17 — História',225),
  ('history.brazilian-empire-second-reign','history','Império brasileiro: Segundo Reinado','Anexo 1, p. 17 — História',226),
  ('history.slavery-abolition-post-abolition','history','Crise do trabalho escravizado, abolição legal e pós-abolição','Anexo 1, p. 17 — História',227),
  ('history.black-slavery-amazonas','history','Escravidão negra no Amazonas: trabalho, fuga e abolição','Anexo 1, p. 17 — História',228),
  ('history.amazon-belle-epoque-rubber','history','Belle Époque Amazônica e exploração gomífera','Anexo 1, p. 17 — História',229),
  ('history.american-republics-formation','history','Formação das repúblicas americanas','Anexo 1, p. 17 — História',230),
  ('history.imperialism-neocolonialism','history','Imperialismo e neocolonialismo na África e Ásia','Anexo 1, p. 17 — História',231),
  ('history.european-nationalisms','history','Nacionalismos europeus, disputas por hegemonia e exclusão','Anexo 1, p. 17 — História',232),
  ('history.us-expansion-imperialism','history','Expansão territorial e imperialismo dos Estados Unidos','Anexo 1, p. 17 — História',233),
  ('history.brazil-republic-formation','history','Ascensão da burguesia e formação da República no Brasil','Anexo 1, p. 17 — História',234),
  ('history.first-republic-crises','history','Crises políticas e sociais na Primeira República','Anexo 1, p. 17 — História',235),
  ('history.labor-movement-vargas-rise','history','Conflitos trabalhistas, movimento operário e ascensão de Vargas em 1930','Anexo 1, p. 17 — História',236),
  ('history.popular-citizenship-struggles','history','Mulheres, negros, indígenas e grupos populares nas lutas por cidadania e poder','Anexo 1, p. 17 — História',237),

  ('geography.brazil-territory-formation','geography','Formação do território brasileiro','Anexo 1, pp. 17–18 — Geografia',301),
  ('geography.amazon-colonization-expansion','geography','Colonização, formação e expansão territorial da Amazônia','Anexo 1, p. 18 — Geografia',302),
  ('geography.brazil-border-disputes','geography','Disputas fronteiriças e territórios incorporados ao Brasil','Anexo 1, p. 18 — Geografia',303),
  ('geography.brazil-development-projects','geography','Projetos de desenvolvimento territorial do Estado brasileiro','Anexo 1, p. 18 — Geografia',304),
  ('geography.brazil-regionalization','geography','Região, regionalização e planejamento regional no Brasil','Anexo 1, p. 18 — Geografia',305),
  ('geography.world-regionalization-development','geography','Regionalizações do espaço mundial e níveis de desenvolvimento','Anexo 1, p. 18 — Geografia',306),
  ('geography.brazil-global-economy','geography','Brasil no cenário da economia global','Anexo 1, p. 18 — Geografia',307),
  ('geography.south-south-cooperation','geography','Cooperação Sul-Sul e países subdesenvolvidos','Anexo 1, p. 18 — Geografia',308),
  ('geography.brazil-sovereignty-land-borders','geography','Soberania nacional e fronteiras terrestres','Anexo 1, p. 18 — Geografia',309),
  ('geography.brazil-maritime-borders','geography','Fronteiras marítimas, Amazônia Azul e Zona Econômica Exclusiva','Anexo 1, p. 18 — Geografia',310),
  ('geography.demographic-theories','geography','Demografia, teorias demográficas e desenvolvimento econômico','Anexo 1, p. 18 — Geografia',311),
  ('geography.population-graphic-representation','geography','Representação gráfica e estrutura etária da população','Anexo 1, p. 18 — Geografia',312),
  ('geography.population-distribution-indicators','geography','Distribuição da população e indicadores socioeconômicos','Anexo 1, p. 18 — Geografia',313),
  ('geography.demographic-transition-social-problems','geography','Crescimento vegetativo, transição demográfica, habitação, saúde e educação','Anexo 1, p. 18 — Geografia',314),
  ('geography.migration-dynamics','geography','Dinâmica populacional e movimentos migratórios','Anexo 1, p. 18 — Geografia',315),
  ('geography.migration-conflicts-xenophobia','geography','Migração, conflitos, diversidade cultural e xenofobia','Anexo 1, p. 18 — Geografia',316),
  ('geography.brazil-ethnic-cultural-formation','geography','Formação étnico-cultural da população brasileira','Anexo 1, p. 18 — Geografia',317),
  ('geography.indigenous-land-demarcation','geography','Povos originários e demarcação de terras','Anexo 1, p. 18 — Geografia',318),
  ('geography.industrial-production-revolutions','geography','Produção industrial e revoluções industriais','Anexo 1, pp. 18–19 — Geografia',319),
  ('geography.brazil-industrialization-zfm','geography','Industrialização brasileira e Zona Franca de Manaus','Anexo 1, p. 19 — Geografia',320),
  ('geography.agricultural-production-systems','geography','Produção agrícola, Revolução Verde e sistemas agrícolas','Anexo 1, p. 19 — Geografia',321),
  ('geography.brazil-amazon-agriculture','geography','Agricultura no Brasil e na Amazônia','Anexo 1, p. 19 — Geografia',322),
  ('geography.land-structure-agrarian-reform','geography','Estrutura fundiária, questão agrária e Reforma Agrária','Anexo 1, p. 19 — Geografia',323),
  ('geography.agribusiness-environment','geography','Agronegócio, commodities e meio ambiente','Anexo 1, p. 19 — Geografia',324),
  ('geography.globalization-networks-multinationals','geography','Globalização, redes, mercadorias e multinacionais','Anexo 1, p. 19 — Geografia',325),
  ('geography.neoliberalism-brazil-world','geography','Globalização, neoliberalismo e economia no Brasil e no mundo','Anexo 1, p. 19 — Geografia',326),
  ('geography.work-technology-unemployment','geography','Sociedade, economia, tecnologia e mundo do trabalho','Anexo 1, p. 19 — Geografia',327),
  ('geography.work-social-indicators-amazonas','geography','Trabalho e indicadores sociais no Brasil e no Amazonas','Anexo 1, p. 19 — Geografia',328),
  ('geography.urban-hierarchy-networks','geography','Hierarquia urbana e redes urbanas','Anexo 1, p. 19 — Geografia',329),
  ('geography.brazil-amazonas-urbanization','geography','Urbanização no Brasil e no Amazonas','Anexo 1, p. 19 — Geografia',330),
  ('geography.urban-segregation-inequality','geography','Segregação urbana e desigualdade social','Anexo 1, p. 19 — Geografia',331),
  ('geography.city-planning-statute','geography','Organização das cidades, Plano Diretor e Estatuto da Cidade','Anexo 1, p. 19 — Geografia',332),

  ('biology.ecology-ecosystems','biology','Ecologia e ecossistemas','Anexo 1, pp. 19–20 — Biologia',401),
  ('biology.ecosystem-matter-energy-flow','biology','Fluxo de matéria e energia nos ecossistemas','Anexo 1, pp. 19–20 — Biologia',402),
  ('biology.greenhouse-effect-global-warming','biology','Efeito estufa e aquecimento global','Anexo 1, p. 20 — Biologia',403),
  ('biology.climate-international-agreements','biology','Protocolo de Kyoto e Acordo de Paris','Anexo 1, p. 20 — Biologia',404),
  ('biology.human-physiology-digestive-respiratory-circulatory','biology','Fisiologia humana: sistemas digestório, respiratório e circulatório','Anexo 1, p. 20 — Biologia',405),
  ('biology.human-physiology-excretory-nervous-endocrine','biology','Fisiologia humana: sistemas excretor, nervoso e endócrino','Anexo 1, p. 20 — Biologia',406),
  ('biology.energy-sources-environment','biology','Fontes de energia e impactos ambientais','Anexo 1, p. 20 — Biologia',407),
  ('biology.technology-waste','biology','Lixo tecnológico','Anexo 1, p. 20 — Biologia',408),
  ('biology.biogeochemical-cycles','biology','Ciclos biogeoquímicos','Anexo 1, p. 20 — Biologia',409),
  ('biology.virology-epidemiology','biology','Virologia, epidemiologia, epidemias e pandemias','Anexo 1, p. 20 — Biologia',410),
  ('biology.biological-risk-protection','biology','Equipamentos de proteção individual e coletiva na prevenção de danos biológicos','Anexo 1, p. 20 — Biologia',411),
  ('biology.public-health','biology','Saúde pública, imunização, medicamentos e desigualdade','Anexo 1, p. 20 — Biologia',412),
  ('biology.neglected-diseases','biology','Doenças negligenciadas','Anexo 1, p. 20 — Biologia',413),

  ('chemistry.thermochemistry','chemistry','Termoquímica: temperatura, equilíbrio térmico, lei de Hess e calor','Anexo 1, p. 20 — Química',501),
  ('chemistry.material-thermal-properties','chemistry','Propriedades térmicas dos materiais e mudanças de estado','Anexo 1, p. 20 — Química',502),
  ('chemistry.environmental-system-imbalances','chemistry','Desequilíbrio de sistemas: efeito estufa, aquecimento global, pesticidas e fertilizantes','Anexo 1, p. 20 — Química',503),
  ('chemistry.radioactivity-radioisotopes','chemistry','Radioatividade e características dos radioisótopos','Anexo 1, p. 20 — Química',504),
  ('chemistry.nuclear-radiation-decay','chemistry','Radiações nucleares e leis de decaimento','Anexo 1, p. 20 — Química',505),
  ('chemistry.radiation-effects','chemistry','Implicações, benefícios e efeitos da radiação nos seres vivos','Anexo 1, p. 20 — Química',506),
  ('chemistry.energy-production-environment','chemistry','Produção e conversão de energia e interações com o meio ambiente','Anexo 1, p. 20 — Química',507),
  ('chemistry.renewable-nonrenewable-energy','chemistry','Fontes renováveis e não renováveis e eficiência dos combustíveis','Anexo 1, p. 20 — Química',508),
  ('chemistry.electrochemistry','chemistry','Eletroquímica: pilhas, baterias, eletrólise, oxidação, redução e corrosão','Anexo 1, p. 20 — Química',509),
  ('chemistry.fuels-combustion-enthalpy','chemistry','Combustíveis fósseis, entalpia de combustão e biocombustíveis','Anexo 1, p. 20 — Química',510),
  ('chemistry.green-chemistry-environment','chemistry','Química verde e impactos ambientais','Anexo 1, p. 20 — Química',511),
  ('chemistry.chemical-kinetics','chemistry','Cinética química: velocidade, teoria das colisões e fatores de reação','Anexo 1, p. 20 — Química',512),
  ('chemistry.biogeochemical-cycles','chemistry','Características químicas dos ciclos biogeoquímicos','Anexo 1, p. 20 — Química',513),
  ('chemistry.ozone-chemical-equilibrium','chemistry','Camada de ozônio e equilíbrio químico','Anexo 1, p. 20 — Química',514),
  ('chemistry.nuclear-accidents','chemistry','Acidentes nucleares: Chernobyl, Fukushima, Three Mile Island e Goiânia','Anexo 1, p. 20 — Química',515),
  ('chemistry.pesticides-chemical-waste','chemistry','Agrotóxicos e produção e descarte de produtos químicos','Anexo 1, p. 20 — Química',516),
  ('chemistry.safety-equipment','chemistry','Equipamentos de proteção individual e coletiva','Anexo 1, p. 20 — Química',517),

  ('physics.thermometric-scales','physics','Escalas termométricas','Anexo 1, p. 20 — Física',601),
  ('physics.sustainable-thermal-systems','physics','Sistemas térmicos sustentáveis e variáveis termodinâmicas','Anexo 1, p. 20 — Física',602),
  ('physics.calorimetry','physics','Calorimetria: calor, propagação, pressão, volume, rendimento e energia','Anexo 1, p. 20 — Física',603),
  ('physics.thermal-radiation-environment','physics','Transferência de energia térmica por radiação e impactos ambientais','Anexo 1, p. 20 — Física',604),
  ('physics.electromagnetic-radiation','physics','Radiações eletromagnéticas: espectro, fontes e interação com a matéria','Anexo 1, p. 20 — Física',605),
  ('physics.radioactivity-radiation-applications','physics','Radioatividade e aplicações da radiação','Anexo 1, pp. 20–21 — Física',606),
  ('physics.nuclear-technology-impacts','physics','Tecnologia nuclear: usos, riscos e impactos sociais, ambientais e de saúde','Anexo 1, pp. 20–21 — Física',607),
  ('physics.electric-energy-generation-transmission','physics','Geração e transmissão de energia elétrica','Anexo 1, p. 21 — Física',608),
  ('physics.energy-efficiency-sustainable-storage','physics','Eficiência energética e formas sustentáveis de obtenção e armazenamento de energia','Anexo 1, p. 21 — Física',609),
  ('physics.electrostatics','physics','Eletrostática: eletrização por atrito, contato e indução','Anexo 1, p. 21 — Física',610),
  ('physics.electrodynamics-devices','physics','Eletrodinâmica e dispositivos elétricos','Anexo 1, p. 21 — Física',611),
  ('physics.renewable-energy-thermal-transformations','physics','Fontes renováveis e transformações de energia em sistemas térmicos','Anexo 1, p. 21 — Física',612),
  ('physics.pollution-contamination','physics','Poluição atmosférica, sonora e visual e contaminação','Anexo 1, p. 21 — Física',613),
  ('physics.electric-shock','physics','Choque elétrico e efeito fisiológico da corrente elétrica','Anexo 1, p. 21 — Física',614),
  ('physics.physical-risk-protection','physics','Proteção individual e coletiva contra riscos físicos','Anexo 1, p. 21 — Física',615),

  ('math.exponential-function','mathematics','Função exponencial','Anexo 1, p. 21 — Matemática',701),
  ('math.logarithmic-function','mathematics','Função logarítmica','Anexo 1, p. 21 — Matemática',702),
  ('math.logarithmic-financial-problems','mathematics','Problemas envolvendo função logarítmica e matemática financeira','Anexo 1, p. 21 — Matemática',703),
  ('math.trigonometric-functions-sine-cosine','mathematics','Funções trigonométricas: seno e cosseno','Anexo 1, p. 21 — Matemática',704),
  ('math.right-triangle-metric-relations','mathematics','Relações métricas no triângulo retângulo','Anexo 1, p. 21 — Matemática',705),
  ('math.arithmetic-progressions','mathematics','Progressões aritméticas','Anexo 1, p. 21 — Matemática',706),
  ('math.geometric-progressions','mathematics','Progressões geométricas','Anexo 1, p. 21 — Matemática',707),
  ('math.financial-progressions','mathematics','Matemática financeira com progressões aritméticas e geométricas','Anexo 1, p. 21 — Matemática',708),
  ('math.matrices-determinants','mathematics','Matrizes e determinantes','Anexo 1, p. 21 — Matemática',709),
  ('math.linear-equation-systems','mathematics','Sistemas de equações lineares','Anexo 1, p. 21 — Matemática',710),
  ('math.algorithms-flowcharts-logic','mathematics','Algoritmos, fluxogramas e lógica matemática','Anexo 1, p. 21 — Matemática',711),
  ('math.programming-logic-algorithmic-reasoning','mathematics','Lógica de programação e raciocínio algorítmico','Anexo 1, p. 21 — Matemática',712),
  ('math.technology-measurement-conversions','mathematics','Unidades de medida e conversões em contextos tecnológicos','Anexo 1, p. 21 — Matemática',713),
  ('math.metric-community-spaces','mathematics','Geometria métrica aplicada a espaços comunitários','Anexo 1, p. 21 — Matemática',714),
  ('math.plane-geometry-area-estimation','mathematics','Geometria plana: cálculo e estimativa de áreas de superfícies','Anexo 1, p. 21 — Matemática',715),
  ('math.plane-spatial-geometry','mathematics','Geometria plana e espacial','Anexo 1, p. 21 — Matemática',716);

insert into public.curriculum_skills(code,subject_code,parent_code,level,name_pt_br,name_en)
select code,subject_code,null,'topic',label,label from psc2_catalog_import
on conflict (code) do update set
  subject_code=excluded.subject_code, level=excluded.level,
  name_pt_br=excluded.name_pt_br, name_en=excluded.name_en;

insert into public.exam_catalog_skills(catalog_version_id,skill_code,source_locator,source_excerpt,display_order)
select '27000000-0000-4000-8000-000000000002',code,source_locator,label,display_order
from psc2_catalog_import
on conflict (catalog_version_id,skill_code) do update set
  source_locator=excluded.source_locator, source_excerpt=excluded.source_excerpt, display_order=excluded.display_order;

insert into public.curriculum_skill_aliases(normalized_alias,skill_code) values
  ('colonização do continente americano','history.americas-colonization'),
  ('pa','math.arithmetic-progressions'),
  ('pg','math.geometric-progressions'),
  ('zfm','geography.brazil-industrialization-zfm'),
  ('zee','geography.brazil-maritime-borders'),
  ('rmm','geography.brazil-amazonas-urbanization')
on conflict (normalized_alias) do nothing;

do $$
declare v_subjects integer; v_skills integer; v_duplicate_labels integer; v_missing_source integer;
begin
  select count(distinct subject_code),count(*) into v_subjects,v_skills from psc2_catalog_import;
  if v_subjects <> 7 then raise exception 'PSC2_IMPORT_INVALID_SUBJECT_COUNT:%',v_subjects; end if;
  if v_skills <> 165 then raise exception 'PSC2_IMPORT_INVALID_SKILL_COUNT:%',v_skills; end if;
  select count(*) into v_duplicate_labels from (select lower(btrim(label)) from psc2_catalog_import group by lower(btrim(label)) having count(*)>1) duplicate;
  if v_duplicate_labels <> 0 then raise exception 'PSC2_IMPORT_DUPLICATE_LABELS:%',v_duplicate_labels; end if;
  select count(*) into v_missing_source from psc2_catalog_import where source_locator='' or label='';
  if v_missing_source <> 0 then raise exception 'PSC2_IMPORT_MISSING_TRACEABILITY:%',v_missing_source; end if;
  if (select status from public.exam_catalog_versions where id='27000000-0000-4000-8000-000000000002') <> 'draft' then raise exception 'PSC2_IMPORT_MUST_REMAIN_DRAFT'; end if;
end $$;
