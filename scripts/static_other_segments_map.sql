-- Static canonical translations for 'Other:' free-text segments across the
-- pipe-separated text columns of the CSTAR pipelines.
--
-- col_family tags determine which pipeline applies which subset:
--   hazard       -> hazard_addressed_english (action+goal), hazard_english (hazard table)
--   populations  -> population_exposed_english (hazard table)
--   sectors      -> sectors_applied_english (action), sectors_exposed_english (hazard)
--   finance      -> finance_status_english, finance_model_english, funding_source_english
--   action       -> action_status_english, cobenefit_realized_english, resilience_enhanced_english
--
-- Loaded as a CTE inside the notebook's other_segments_map build cell:
--   STATIC_MAP_SQL = open('static_other_segments_map.sql').read()
--   query = f"WITH static_map AS ({STATIC_MAP_SQL}) ..."
--
-- Sourced from 12d (cross-table inventory of foreign-language 'Other:'
-- segments). Only the high-occurrence canonical entries are mapped here;
-- long free-text disclosures flow through ML translation as-is.

SELECT * FROM UNNEST([
  -------------------------------------------------------------------
  -- col_family = 'hazard'  (was static_other_hazard_map.sql)
  -------------------------------------------------------------------
  STRUCT('Other: Granizo'                                       AS raw, 'Other: Hail'                                   AS clean, 'hazard' AS col_family),
  STRUCT('Other: Chuvas de granizo'                             AS raw, 'Other: Hailstorms'                             AS clean, 'hazard' AS col_family),
  STRUCT('Other: Radiación UV'                                  AS raw, 'Other: UV radiation'                           AS clean, 'hazard' AS col_family),
  STRUCT('Other: Radiacion UV'                                  AS raw, 'Other: UV radiation'                           AS clean, 'hazard' AS col_family),
  STRUCT('Other: Seca'                                          AS raw, 'Other: Drought'                                AS clean, 'hazard' AS col_family),
  STRUCT('Other: Secas'                                         AS raw, 'Other: Droughts'                               AS clean, 'hazard' AS col_family),
  STRUCT('Other: Sequia'                                        AS raw, 'Other: Drought'                                AS clean, 'hazard' AS col_family),
  STRUCT('Other: Sequias'                                       AS raw, 'Other: Droughts'                               AS clean, 'hazard' AS col_family),
  STRUCT('Other: Sequías'                                       AS raw, 'Other: Droughts'                               AS clean, 'hazard' AS col_family),
  STRUCT('Other: Isla de calor urbana'                          AS raw, 'Other: Urban heat island'                      AS clean, 'hazard' AS col_family),
  STRUCT('Other: Islas de calor urbanas'                        AS raw, 'Other: Urban heat islands'                     AS clean, 'hazard' AS col_family),
  STRUCT('Other: Ilha de calor urbano'                          AS raw, 'Other: Urban heat island'                      AS clean, 'hazard' AS col_family),
  STRUCT('Other: Efecto isla de calor urbana'                   AS raw, 'Other: Urban heat island effect'               AS clean, 'hazard' AS col_family),
  STRUCT('Other: Efecto de islas de calor urbanas'              AS raw, 'Other: Urban heat island effect'               AS clean, 'hazard' AS col_family),
  STRUCT('Other: Ola de calor'                                  AS raw, 'Other: Heat wave'                              AS clean, 'hazard' AS col_family),
  STRUCT('Other: Olas de calor'                                 AS raw, 'Other: Heat waves'                             AS clean, 'hazard' AS col_family),
  STRUCT('Other: Ondas de calor'                                AS raw, 'Other: Heat waves'                             AS clean, 'hazard' AS col_family),
  STRUCT('Other: Temperaturas extremas'                         AS raw, 'Other: Extreme temperatures'                   AS clean, 'hazard' AS col_family),
  STRUCT('Other: Incendio forestal'                             AS raw, 'Other: Wildfire'                               AS clean, 'hazard' AS col_family),
  STRUCT('Other: Incendios'                                     AS raw, 'Other: Fires'                                  AS clean, 'hazard' AS col_family),
  STRUCT('Other: Fuego terrestre'                               AS raw, 'Other: Ground fire'                            AS clean, 'hazard' AS col_family),
  STRUCT('Other: Movimento de massa'                            AS raw, 'Other: Mass movement'                          AS clean, 'hazard' AS col_family),
  STRUCT('Other: Calidad aire'                                  AS raw, 'Other: Air quality'                            AS clean, 'hazard' AS col_family),
  STRUCT('Other: Anegamiento'                                   AS raw, 'Other: Waterlogging'                           AS clean, 'hazard' AS col_family),
  STRUCT('Other: Seguridad alimentaria'                         AS raw, 'Other: Food security'                          AS clean, 'hazard' AS col_family),
  STRUCT('Other: Inseguridad alimentaria'                       AS raw, 'Other: Food insecurity'                        AS clean, 'hazard' AS col_family),
  STRUCT('Other: Soberanía alimentaria'                         AS raw, 'Other: Food sovereignty'                       AS clean, 'hazard' AS col_family),
  STRUCT('Other: Salud laboral'                                 AS raw, 'Other: Occupational health'                    AS clean, 'hazard' AS col_family),
  STRUCT('Other: Impactos negativos en la salud'                AS raw, 'Other: Negative health impacts'                AS clean, 'hazard' AS col_family),
  STRUCT('Other: Desarrollo urbano'                             AS raw, 'Other: Urban development'                      AS clean, 'hazard' AS col_family),
  STRUCT('Other: Torbellinos'                                   AS raw, 'Other: Tornadoes'                              AS clean, 'hazard' AS col_family),
  STRUCT('Other: Hundimiento'                                   AS raw, 'Other: Subsidence'                             AS clean, 'hazard' AS col_family),
  STRUCT('Other: Escasez de agua'                               AS raw, 'Other: Water scarcity'                         AS clean, 'hazard' AS col_family),
  STRUCT('Other: Escasez hídrica'                               AS raw, 'Other: Water scarcity'                         AS clean, 'hazard' AS col_family),
  STRUCT('Other: Subida do nível médio do mar'                  AS raw, 'Other: Sea level rise'                         AS clean, 'hazard' AS col_family),
  STRUCT('Other: Enfermedad alérgicas'                          AS raw, 'Other: Allergic diseases'                      AS clean, 'hazard' AS col_family),
  STRUCT('Other: pérdida de insfraestructura'                   AS raw, 'Other: Infrastructure loss'                    AS clean, 'hazard' AS col_family),
  STRUCT('Other: Riscos tecnológicos'                           AS raw, 'Other: Technological risks'                    AS clean, 'hazard' AS col_family),
  STRUCT('Other: Incorrecta gestión de residuos'                AS raw, 'Other: Incorrect waste management'             AS clean, 'hazard' AS col_family),
  STRUCT('Other: Independencia energética'                      AS raw, 'Other: Energy independence'                    AS clean, 'hazard' AS col_family),
  STRUCT('Other: Gestão Ambiental'                              AS raw, 'Other: Environmental management'               AS clean, 'hazard' AS col_family),
  STRUCT('Other: Creación de capacidades en comunidad escolar'  AS raw, 'Other: Capacity building in school community'  AS clean, 'hazard' AS col_family),
  STRUCT('Other: Aumento de energia limpa no municipio'         AS raw, 'Other: Increased clean energy in municipality' AS clean, 'hazard' AS col_family),
  STRUCT('Other: Aumento de las malas olores'                   AS raw, 'Other: Increase in bad odors'                  AS clean, 'hazard' AS col_family),
  STRUCT('Other: no se'                                         AS raw, 'Other: Unknown'                                AS clean, 'hazard' AS col_family),
  STRUCT('Other: No se'                                         AS raw, 'Other: Unknown'                                AS clean, 'hazard' AS col_family),
  STRUCT('Other: no hay'                                        AS raw, 'Other: None'                                   AS clean, 'hazard' AS col_family),
  STRUCT('Other: 재해 대응'                                      AS raw, 'Other: Disaster response'                     AS clean, 'hazard' AS col_family),
  STRUCT('Other: 수질'                                           AS raw, 'Other: Water quality'                         AS clean, 'hazard' AS col_family),
  STRUCT('Other: 대기질 오염'                                    AS raw, 'Other: Air pollution'                         AS clean, 'hazard' AS col_family),

  -------------------------------------------------------------------
  -- col_family = 'sectors'  (sectors_applied / sectors_exposed)
  -------------------------------------------------------------------
  -- Portuguese (very high frequency in solution_examples — 840 of 'Proteção Civil')
  STRUCT('Other: Proteção Civil'                                                       AS raw, 'Other: Civil Protection'                                                AS clean, 'sectors' AS col_family),
  STRUCT('Other: Qualidade Ambiental e Urbana/Hipervisor Urbano e Inovação'            AS raw, 'Other: Urban and Environmental Quality / Urban Hypervisor and Innovation' AS clean, 'sectors' AS col_family),
  STRUCT('Other: Recursos Hídricos'                                                    AS raw, 'Other: Water Resources'                                                 AS clean, 'sectors' AS col_family),
  STRUCT('Other: Recarga hídrica'                                                      AS raw, 'Other: Water recharge'                                                  AS clean, 'sectors' AS col_family),
  STRUCT('Other: Habitação'                                                            AS raw, 'Other: Housing'                                                         AS clean, 'sectors' AS col_family),
  STRUCT('Other: Habitação; Serviços; Infraestrutura pública'                          AS raw, 'Other: Housing; Services; Public infrastructure'                       AS clean, 'sectors' AS col_family),
  STRUCT('Other: Infraestrutura pública; Serviços'                                     AS raw, 'Other: Public infrastructure; Services'                                 AS clean, 'sectors' AS col_family),
  STRUCT('Other: Infraestructura pública y privada'                                    AS raw, 'Other: Public and private infrastructure'                               AS clean, 'sectors' AS col_family),
  STRUCT('Other: Edifícios'                                                            AS raw, 'Other: Buildings'                                                       AS clean, 'sectors' AS col_family),
  STRUCT('Other: Ordenamento do Território'                                            AS raw, 'Other: Land use planning'                                               AS clean, 'sectors' AS col_family),
  STRUCT('Other: Monitorização de recursos hídricos'                                   AS raw, 'Other: Water resource monitoring'                                       AS clean, 'sectors' AS col_family),
  STRUCT('Other: Espaços verdes, Biodiversidade'                                       AS raw, 'Other: Green spaces, Biodiversity'                                      AS clean, 'sectors' AS col_family),
  STRUCT('Other: Proteção de Pessoas e Bens'                                           AS raw, 'Other: Protection of people and property'                               AS clean, 'sectors' AS col_family),
  STRUCT('Other: Participação e envolvimento da comunidade'                            AS raw, 'Other: Community participation and engagement'                          AS clean, 'sectors' AS col_family),
  STRUCT('Other: Valoriza os arranjos produtivos locais e a conservação dos ecossistemas' AS raw, 'Other: Promotes local production arrangements and ecosystem conservation' AS clean, 'sectors' AS col_family),
  STRUCT('Other: Atividades portuárias e retroportuárias'                              AS raw, 'Other: Port and retroport activities'                                   AS clean, 'sectors' AS col_family),
  STRUCT('Other: Munícipes'                                                            AS raw, 'Other: Residents'                                                       AS clean, 'sectors' AS col_family),
  -- Spanish
  STRUCT('Other: Sector turístico'                                                     AS raw, 'Other: Tourism sector'                                                  AS clean, 'sectors' AS col_family),
  STRUCT('Other: Sector Turístico'                                                     AS raw, 'Other: Tourism sector'                                                  AS clean, 'sectors' AS col_family),
  STRUCT('Other: Sector turístico, portuario e industrial'                             AS raw, 'Other: Tourism, port, and industrial sector'                            AS clean, 'sectors' AS col_family),
  STRUCT('Other: Sectores: turístico, hotelero, portuario e industrial'                AS raw, 'Other: Sectors: tourism, hotel, port, and industrial'                   AS clean, 'sectors' AS col_family),
  STRUCT('Other: Sector de Energético, Infraestructura'                                AS raw, 'Other: Energy sector, Infrastructure'                                   AS clean, 'sectors' AS col_family),
  STRUCT('Other: Ganadería'                                                            AS raw, 'Other: Livestock'                                                       AS clean, 'sectors' AS col_family),
  STRUCT('Other: turismo y áreas verdes'                                               AS raw, 'Other: Tourism and green spaces'                                        AS clean, 'sectors' AS col_family),
  STRUCT('Other: Planificación y uso de la tierra Residencial'                         AS raw, 'Other: Land use planning, Residential'                                  AS clean, 'sectors' AS col_family),
  STRUCT('Other: gestión recursos hídricos'                                            AS raw, 'Other: Water resource management'                                       AS clean, 'sectors' AS col_family),
  STRUCT('Other: Género y grupos vulnerables de la ciudad'                             AS raw, 'Other: Gender and vulnerable city groups'                               AS clean, 'sectors' AS col_family),
  -- French
  STRUCT('Other: Efficacité énergétique et Energie renouvelable'                       AS raw, 'Other: Energy efficiency and renewable energy'                          AS clean, 'sectors' AS col_family),
  STRUCT('Other: Quartiers précaires'                                                  AS raw, 'Other: Precarious neighborhoods'                                        AS clean, 'sectors' AS col_family),
  -- Japanese
  STRUCT('Other: 住宅'                                                                  AS raw, 'Other: Housing'                                                         AS clean, 'sectors' AS col_family),
  STRUCT('Other: 文化、観光'                                                            AS raw, 'Other: Culture, tourism'                                                AS clean, 'sectors' AS col_family),
  STRUCT('Other: 防災・減災'                                                            AS raw, 'Other: Disaster prevention and mitigation'                              AS clean, 'sectors' AS col_family),

  -------------------------------------------------------------------
  -- col_family = 'populations'  (population_exposed_english)
  -------------------------------------------------------------------
  STRUCT('Other: Personas en condición de calle'                                       AS raw, 'Other: Homeless people'                                                 AS clean, 'populations' AS col_family),
  STRUCT('Other: Personas en situación de calle.'                                      AS raw, 'Other: Homeless people'                                                 AS clean, 'populations' AS col_family),
  STRUCT('Other: Personas que viven en situación de calle, Lactantes.'                 AS raw, 'Other: Homeless people, infants'                                        AS clean, 'populations' AS col_family),
  STRUCT('Other: Población afincada en el medio rural'                                 AS raw, 'Other: Rural-resident population'                                       AS clean, 'populations' AS col_family),
  STRUCT('Other: Población dedicada al sector primario'                                AS raw, 'Other: Primary-sector population'                                       AS clean, 'populations' AS col_family),
  STRUCT('Other: Población en general'                                                 AS raw, 'Other: General population'                                              AS clean, 'populations' AS col_family),
  STRUCT('Other: población en general'                                                 AS raw, 'Other: General population'                                              AS clean, 'populations' AS col_family),
  STRUCT('Other: Población rural'                                                      AS raw, 'Other: Rural population'                                                AS clean, 'populations' AS col_family),
  STRUCT('Other: población vulnerable'                                                 AS raw, 'Other: Vulnerable population'                                           AS clean, 'populations' AS col_family),
  STRUCT('Other: Deficientes físicos'                                                  AS raw, 'Other: People with physical disabilities'                               AS clean, 'populations' AS col_family),
  STRUCT('Other: Pessoas com deficiência'                                              AS raw, 'Other: People with disabilities'                                        AS clean, 'populations' AS col_family),
  STRUCT('Other: População Rural'                                                      AS raw, 'Other: Rural population'                                                AS clean, 'populations' AS col_family),
  STRUCT('Other: População em geral'                                                   AS raw, 'Other: General population'                                              AS clean, 'populations' AS col_family),
  STRUCT('Other: Sector turístico'                                                     AS raw, 'Other: Tourism sector'                                                  AS clean, 'populations' AS col_family),
  STRUCT('Other: Agricultura, Ganadería e Industrial'                                  AS raw, 'Other: Agriculture, Livestock, and Industrial'                          AS clean, 'populations' AS col_family),
  STRUCT('Other: La población de Estado de Querétaro'                                  AS raw, 'Other: The population of the State of Querétaro'                        AS clean, 'populations' AS col_family),

  -------------------------------------------------------------------
  -- col_family = 'finance'  (finance_status / finance_model / funding_source)
  -------------------------------------------------------------------
  STRUCT('Other: Cooperación Internacional'                                            AS raw, 'Other: International cooperation'                                       AS clean, 'finance' AS col_family),
  STRUCT('Other: Organismos de cooperación internacional'                              AS raw, 'Other: International cooperation agencies'                              AS clean, 'finance' AS col_family),

  -- Curated additions from cross-table survey (>=3 occurrences each, canonical short form).
  -- 'sectors' additions
  STRUCT('Other: Planificación y uso de la tierra'                                     AS raw, 'Other: Land use planning'                                               AS clean, 'sectors' AS col_family),
  STRUCT('Other: planificación y uso de la tierra'                                     AS raw, 'Other: Land use planning'                                               AS clean, 'sectors' AS col_family),
  STRUCT('Other: planificación del uso de la tierra'                                   AS raw, 'Other: Land use planning'                                               AS clean, 'sectors' AS col_family),
  STRUCT('Other: gestión de emergencias'                                               AS raw, 'Other: Emergency management'                                            AS clean, 'sectors' AS col_family),
  STRUCT('Other: Gestión de emergencia'                                                AS raw, 'Other: Emergency management'                                            AS clean, 'sectors' AS col_family),
  STRUCT('Other: Emergencias climáticas'                                               AS raw, 'Other: Climate emergencies'                                             AS clean, 'sectors' AS col_family),
  STRUCT('Other: emergencias climáticas y ciudadanía'                                  AS raw, 'Other: Climate emergencies and citizenship'                             AS clean, 'sectors' AS col_family),
  STRUCT('Other: energía'                                                              AS raw, 'Other: Energy'                                                          AS clean, 'sectors' AS col_family),
  STRUCT('Other: Energía'                                                              AS raw, 'Other: Energy'                                                          AS clean, 'sectors' AS col_family),
  STRUCT('Other: ciudadanía'                                                           AS raw, 'Other: Citizenship'                                                     AS clean, 'sectors' AS col_family),
  STRUCT('Other: Ciudadanía'                                                           AS raw, 'Other: Citizenship'                                                     AS clean, 'sectors' AS col_family),
  STRUCT('Other: Recursos hídricos'                                                    AS raw, 'Other: Water resources'                                                 AS clean, 'sectors' AS col_family),
  STRUCT('Other: salud pública'                                                        AS raw, 'Other: Public health'                                                   AS clean, 'sectors' AS col_family),
  STRUCT('Other: Adaptación'                                                           AS raw, 'Other: Adaptation'                                                      AS clean, 'sectors' AS col_family),
  STRUCT('Other: alimentación'                                                         AS raw, 'Other: Food'                                                            AS clean, 'sectors' AS col_family),
  STRUCT('Other: Vivienda y hábitat'                                                   AS raw, 'Other: Housing and habitat'                                             AS clean, 'sectors' AS col_family),
  STRUCT('Other: Educação Ambiental'                                                   AS raw, 'Other: Environmental education'                                         AS clean, 'sectors' AS col_family),

  -- 'populations' additions
  STRUCT('Other: toda la población'                                                    AS raw, 'Other: Entire population'                                               AS clean, 'populations' AS col_family),
  STRUCT('Other: Toda la población'                                                    AS raw, 'Other: Entire population'                                               AS clean, 'populations' AS col_family),
  STRUCT('Other: Toda a população'                                                     AS raw, 'Other: Entire population'                                               AS clean, 'populations' AS col_family),
  STRUCT('Other: Personas en situación de calle'                                       AS raw, 'Other: Homeless people'                                                 AS clean, 'populations' AS col_family),
  STRUCT('Other: Profesionales de la Ciencia y Técnica'                                AS raw, 'Other: Science and Technology professionals'                            AS clean, 'populations' AS col_family),
  STRUCT('Other: personal de recolección de residuos'                                  AS raw, 'Other: Waste collection workers'                                        AS clean, 'populations' AS col_family),
  STRUCT('Other: empleados de recolección'                                             AS raw, 'Other: Collection workers'                                              AS clean, 'populations' AS col_family),
  STRUCT('Other: Empleados de la construcción y edificios en general'                  AS raw, 'Other: Construction and buildings workers'                              AS clean, 'populations' AS col_family),
  STRUCT('Other: Personal técnico abocado a realizar trabajo de campo'                 AS raw, 'Other: Field-work technical personnel'                                  AS clean, 'populations' AS col_family),
  STRUCT('Other: Personas menores de 14 años'                                          AS raw, 'Other: People under 14 years old'                                       AS clean, 'populations' AS col_family),
  STRUCT('Other: pequeños productores agrícolas'                                       AS raw, 'Other: Small agricultural producers'                                    AS clean, 'populations' AS col_family),
  STRUCT('Other: população em geral'                                                   AS raw, 'Other: General population'                                              AS clean, 'populations' AS col_family),
  STRUCT('Other: 全市民'                                                                AS raw, 'Other: All citizens'                                                    AS clean, 'populations' AS col_family),
  STRUCT('Other: 災害時要配慮者（災害時に自力で避難することが困難で、在宅で生活している高齢者や障害のある方など）' AS raw, 'Other: People requiring special consideration in disasters (e.g., elderly and disabled people who live at home and have difficulty evacuating on their own)' AS clean, 'populations' AS col_family),

  -- 'finance' additions
  STRUCT('Other: Programas e fundos da União Europeia'                                 AS raw, 'Other: European Union programs and funds'                               AS clean, 'finance' AS col_family),
  STRUCT('Other: Fundos e programas da União Europeia'                                 AS raw, 'Other: European Union funds and programs'                               AS clean, 'finance' AS col_family),
  STRUCT('Other: Alianza público-privada'                                              AS raw, 'Other: Public-private partnership'                                      AS clean, 'finance' AS col_family),
  STRUCT('Other: Recursos próprios e externos'                                         AS raw, 'Other: Internal and external resources'                                 AS clean, 'finance' AS col_family),
  STRUCT('Other: No se identifica ningún modelo financiero en particular.'             AS raw, 'Other: No specific financing model identified.'                         AS clean, 'finance' AS col_family)
])