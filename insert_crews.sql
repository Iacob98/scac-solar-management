-- Insert crews and crew members for firm_id = 1
-- Safe for re-runs: deletes existing members first, then upserts crews, then inserts members
BEGIN;

-- Step 1: Delete existing crew_members for these crews
DELETE FROM crew_members WHERE crew_id IN (
  SELECT id FROM crews WHERE firm_id = 1 AND unique_number IN (
    'MT1','MT2','MT3','MT4','MT5','MT6','MT7','MT8','MT9','MT10',
    'MT11','MT12','MT13','MT14','MT15','MT16','MT17','MT18','MT19','MT20',
    'MT21','MT22','MT23','MT24','MT25','MT27','MT29','MT30','MT31','MT32',
    'MT33','MT34','MT35','MT36','MT37','MT38','MT39','MT40','MT41','MT42',
    'MT43','MT44','MT45','MT46','MT47','MT48','MT49','MT50','MT51','MT52',
    'MT53','MT54','MT55','MT56','MT57','MT58','MT59','MT60','MT61','MT62',
    'MT64','MT65','MT66','MT67','MT68','MT69','MT70','MT71','MT72','MT73',
    'MT74','MT75','MT76'
  )
);

-- Step 2: Upsert crews
INSERT INTO crews (firm_id, name, unique_number, leader_name, phone, status)
VALUES
  (1, 'HP CEP MT 1', 'MT1', 'Vladyslav Kybukevych', '380734829093', 'active'),
  (1, 'HP CEP MT 2', 'MT2', 'Ohiievych Roman', '380969681655', 'active'),
  (1, 'HP CEP MT 3', 'MT3', 'Svyrydovych Hryhorii', '380962447192', 'active'),
  (1, 'HP CEP MT 4', 'MT4', 'Serhii Moisiuk', '491633359753', 'active'),
  (1, 'HP CEP MT 5', 'MT5', 'Mykhailo Ksonyhzyk', '491723118145', 'active'),
  (1, 'HP CEP MT 6', 'MT6', 'Savka Ivan', '491601289791', 'active'),
  (1, 'HP CEP MT 7', 'MT7', 'Oshurko Davyd', '380964797162', 'active'),
  (1, 'HP CEP MT 8', 'MT8', 'Ivan Balanovych', '380675882465', 'active'),
  (1, 'HP CEP MT 9', 'MT9', 'Zainulin Ruslan', '37367499914', 'active'),
  (1, 'HP CEP MT 10', 'MT10', 'Kubai Roman', '380977826092', 'active'),
  (1, 'HP CEP MT 11', 'MT11', 'Lakusta Serhii', '380954810604', 'active'),
  (1, 'HP CEP MT 12', 'MT12', 'KOTIAI DMYTRO', '380981241441', 'active'),
  (1, 'HP CEP MT 13', 'MT13', 'Lehkyi Artur', '380962644170', 'active'),
  (1, 'HP CEP MT 14', 'MT14', 'KOVALETS VALENTYN', '380685567970', 'active'),
  (1, 'HP CEP MT 15', 'MT15', 'CHURYLOVYCH ANATOLII', '380988858016', 'active'),
  (1, 'HP CEP MT 16', 'MT16', 'ROMAN OHIIEVYCH', NULL, 'active'),
  (1, 'HP CEP MT 17', 'MT17', 'Dmytro Khomych', '380678601447', 'active'),
  (1, 'HP CEP MT 18', 'MT18', 'Valerii Georgievich Kryliuk', '4915560475300', 'active'),
  (1, 'HP CEP MT 19', 'MT19', 'Taras Kravets', '380988216604', 'active'),
  (1, 'HP CEP MT 20', 'MT20', 'Yurii Krupych', '380687786130', 'active'),
  (1, 'HP CEP MT 21', 'MT21', 'Roman Velychko', '380681487549', 'active'),
  (1, 'HP CEP MT 22', 'MT22', 'Ohiievych Nazar', '380682121381', 'active'),
  (1, 'HP CEP MT 23', 'MT23', 'Marynych Serhii', '380982875201', 'active'),
  (1, 'HP CEP MT 24', 'MT24', 'Yaromych Ruslan', '380986615539', 'active'),
  (1, 'HP CEP MT 25', 'MT25', 'Nykytchuk Ivan', '380679841030', 'active'),
  (1, 'HP CEP MT 27', 'MT27', 'Ohievych Ihor', '380976395946', 'active'),
  (1, 'HP CEP MT 29', 'MT29', 'Molchanovych Serhii', '48694689814', 'active'),
  (1, 'HP CEP MT 30', 'MT30', 'Turenko Viacheslav', NULL, 'active'),
  (1, 'HP CEP MT 31', 'MT31', 'Artur Korychak', '4916095040588', 'active'),
  (1, 'HP CEP MT 32', 'MT32', 'RUNKEVYCH OLEKSANDR', '380666159297', 'active'),
  (1, 'HP CEP MT 33', 'MT33', 'Ohiievych Yevhenii', '380682269772', 'active'),
  (1, 'HP CEP MT 34', 'MT34', 'Yeremeichuk Oleksandr', '380973953617', 'active'),
  (1, 'HP CEP MT 35', 'MT35', 'Moisiuk Hryhorii', '491748384907', 'active'),
  (1, 'HP CEP MT 36', 'MT36', 'TUSHYNSKYI IVAN', '380978073149', 'active'),
  (1, 'HP CEP MT 37', 'MT37', 'DANYLIUK MYKHAILO', NULL, 'active'),
  (1, 'HP CEP MT 38', 'MT38', 'Serhii Bulhak', NULL, 'active'),
  (1, 'HP CEP MT 39', 'MT39', 'Mykola Baldych', NULL, 'active'),
  (1, 'HP CEP MT 40', 'MT40', 'VITALII MARYNYCH', NULL, 'active'),
  (1, 'HP CEP MT 41', 'MT41', 'Pavlovich Anatolii', '380961287232', 'active'),
  (1, 'HP CEP MT 42', 'MT42', 'OHIIEVYCH ANDRII', '32465394336', 'active'),
  (1, 'HP CEP MT 43', 'MT43', 'Kupchuk Yaroslav', '380982486504', 'active'),
  (1, 'HP CEP MT 44', 'MT44', 'VASYLEVYCH DMYTRO', '380982500738', 'active'),
  (1, 'HP CEP MT 45', 'MT45', 'ROMAN KOVALETS', '380687342590', 'active'),
  (1, 'HP CEP MT 46', 'MT46', 'Andrii Abramchenko', '491747606664', 'active'),
  (1, 'HP CEP MT 47', 'MT47', 'Mykola Lekhkobyt', '48884968303', 'active'),
  (1, 'HP CEP MT 48', 'MT48', 'Khomiv Vasyl', NULL, 'active'),
  (1, 'HP CEP MT 49', 'MT49', 'Kuzmenko Serhii', NULL, 'active'),
  (1, 'HP CEP MT 50', 'MT50', 'OHIIEVYCH MAKSYM', NULL, 'active'),
  (1, 'HP CEP MT 51', 'MT51', 'Mazur Ivan', NULL, 'active'),
  (1, 'HP CEP MT 52', 'MT52', 'Volodymyr Zhabiuk', '380988996559', 'active'),
  (1, 'HP CEP MT 53', 'MT53', 'MYKHAILO CHMUNEVYCH', NULL, 'active'),
  (1, 'HP CEP MT 54', 'MT54', 'Denys Roslyi', '380639409044', 'active'),
  (1, 'HP CEP MT 55', 'MT55', 'Viacheslav Shkliaiev', NULL, 'active'),
  (1, 'HP CEP MT 56', 'MT56', 'Roman Tymitskyi', '420725441649', 'active'),
  (1, 'HP CEP MT 57', 'MT57', 'Andrii Velychko', '380984294440', 'active'),
  (1, 'HP CEP MT 58', 'MT58', 'Smyk Denys', '380507234618', 'active'),
  (1, 'HP CEP MT 59', 'MT59', 'Maksym Yatsenko', NULL, 'active'),
  (1, 'HP CEP MT 60', 'MT60', 'Ohiievych Roman', NULL, 'active'),
  (1, 'HP CEP MT 61', 'MT61', 'Leskovets Yurii', '380983364390', 'active'),
  (1, 'HP CEP MT 62', 'MT62', 'Nazarii Naumovich', '380970454659', 'active'),
  (1, 'HP CEP MT 64', 'MT64', 'Staniunas Antonas', '4917672264154', 'active'),
  (1, 'HP CEP MT 65', 'MT65', 'DROBUSH MYKOLA', '380982387942', 'active'),
  (1, 'HP CEP MT 66', 'MT66', 'OHIIEVYCH SERHII', '380982851175', 'active'),
  (1, 'HP CEP MT 67', 'MT67', 'ANDRII KRAVCHUK', NULL, 'active'),
  (1, 'HP CEP MT 68', 'MT68', 'Yanishevskyi Yevhen', '4915116547619', 'active'),
  (1, 'HP CEP MT 69', 'MT69', 'Mykola Krupych', '358465488579', 'active'),
  (1, 'HP CEP MT 70', 'MT70', 'Zavadskyi Vitalii', '380668071904', 'active'),
  (1, 'HP CEP MT 71', 'MT71', 'Yevhenii Tolmachov', '491758711090', 'active'),
  (1, 'HP CEP MT 72', 'MT72', 'Andrei Coziruc', NULL, 'active'),
  (1, 'HP CEP MT 73', 'MT73', 'Lisovets Oleksandr', '380987502828', 'active'),
  (1, 'HP CEP MT 74', 'MT74', 'Rostyslav Dovhaniuk', NULL, 'active'),
  (1, 'HP CEP MT 75', 'MT75', 'Pavlovych Mykola', '380965379729', 'active'),
  (1, 'HP CEP MT 76', 'MT76', 'MARIAN IVAN', NULL, 'active')
ON CONFLICT (firm_id, unique_number) DO UPDATE SET
  name = EXCLUDED.name,
  leader_name = EXCLUDED.leader_name,
  phone = EXCLUDED.phone,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Step 3: Insert crew_members
-- MT1
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT1'), 'Vladyslav', 'Kybukevych', '380734829093', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT1'), 'Vasyl', 'Ohiievych', '380989463003', 'worker');

-- MT2
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT2'), 'Roman', 'Ohiievych', '380969681655', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT2'), 'Ihor', 'Ohiievych', '380689841041', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT2'), 'Dmytro', 'Ohiievych', '380986186898', 'worker');

-- MT3
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT3'), 'Hryhorii', 'Svyrydovych', '380962447192', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT3'), 'Mykola', 'Svyrydovych', '380978607134', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT3'), 'Ruslan', 'Svyrydovych', '4915253032868', 'worker');

-- MT4
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT4'), 'Serhii', 'Moisiuk', '491633359753', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT4'), 'Serhii', 'Moisiuk', '491630083822', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT4'), 'Oleh', 'Rezanovych', '380966957295', 'worker');

-- MT5
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT5'), 'Mykhailo', 'Ksonyhzyk', '491723118145', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT5'), 'Ihor', 'Haber', '380986222841', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT5'), 'Mihailo', 'Grisin', '380968578298', 'worker');

-- MT6
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT6'), 'Ivan', 'Savka', '491601289791', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT6'), 'Artur Yurievich', 'Kozachuk', '491638624851', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT6'), 'Heorhii', 'Khynku', '4915775159134', 'worker');

-- MT7
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT7'), 'Davyd', 'Oshurko', '380964797162', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT7'), 'Oleksandr', 'Oshurko', '4915219202866', 'worker');

-- MT8
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT8'), 'Ivan', 'Balanovych', '380675882465', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT8'), 'Dmytro', 'Ogievych', '380689618768', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT8'), 'Ruslan', 'Ogievych', '380986977889', 'worker');

-- MT9
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT9'), 'Ruslan', 'Zainulin', '37367499914', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT9'), 'Yevhen', 'Shevchuk', '4915257635065', 'worker');

-- MT10
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT10'), 'Roman', 'Kubai', '380977826092', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT10'), 'Hryhorii', 'Chuhai', '380981321958', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT10'), 'Dmytro', 'Kusik', '380978255378', 'worker');

-- MT11
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT11'), 'Serhii', 'Lakusta', '380954810604', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT11'), 'Dmytro', 'Mykhailiuk', '491633754441', 'worker');

-- MT12
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT12'), 'DMYTRO', 'KOTIAI', '380981241441', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT12'), 'VITALII', 'OHIIEVYCH', '380977950201', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT12'), 'OLEKSANDER', 'KOTIAI', '4915770952560', 'worker');

-- MT13
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT13'), 'Artur', 'Lehkyi', '380962644170', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT13'), 'Ruslan', 'Hamza', '380678562079', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT13'), 'Mykola', 'Chmunevych', '380678562079', 'worker');

-- MT14
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT14'), 'VALENTYN', 'KOVALETS', '380685567970', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT14'), 'VOLODYMYR', 'PYSHNIAK', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT14'), 'YURII', 'ZHEZHUK', '380685059420', 'worker');

-- MT15
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT15'), 'ANATOLII', 'CHURYLOVYCH', '380988858016', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT15'), 'Viktor', 'Kovalets', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT15'), 'Vitalij', 'Kovalov', NULL, 'worker');

-- MT16
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT16'), 'ROMAN', 'OHIIEVYCH', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT16'), 'Nazar', 'Kovalets', '380965839458', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT16'), 'YURII', 'OHIIEVYCH', NULL, 'worker');

-- MT17
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT17'), 'Dmytro', 'Khomych', '380678601447', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT17'), 'Anatolii', 'Perekhodko', '380982607362', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT17'), 'Ivan', 'Perekhodko', NULL, 'worker');

-- MT18
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT18'), 'Valerii Georgievich', 'Kryliuk', '4915560475300', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT18'), 'Sergii', '', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT18'), 'Petro', 'Mudrak', '447512017765', 'worker');

-- MT19
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT19'), 'Taras', 'Kravets', '380988216604', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT19'), 'Kostiantyn', 'Toiunda', '380976782448', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT19'), 'Oleksandr', 'Kaliuta', NULL, 'worker');

-- MT20
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT20'), 'Yurii', 'Krupych', '380687786130', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT20'), 'Ivan', 'Pyshniak', '380976609410', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT20'), 'Maksym', 'Zhezhuk', '48539059138', 'worker');

-- MT21
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT21'), 'Roman', 'Velychko', '380681487549', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT21'), 'Pavlo', 'Kotsiubailo', NULL, 'worker');

-- MT22
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT22'), 'Nazar', 'Ohiievych', '380682121381', 'leader');

-- MT23
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT23'), 'Serhii', 'Marynych', '380982875201', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT23'), 'Vasyl', 'Koloda', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT23'), 'Oleksandr', 'Marynych', NULL, 'worker');

-- MT24
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT24'), 'Ruslan', 'Yaromych', '380986615539', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT24'), 'Andrii', 'Kotiai', NULL, 'worker');

-- MT25
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT25'), 'Ivan', 'Nykytchuk', '380679841030', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT25'), 'Volodymyr', 'Soroka', '380688346462', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT25'), 'Roman', 'Hamza', '380681776155', 'worker');

-- MT27
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT27'), 'Ihor', 'Ohievych', '380976395946', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT27'), 'Maksym', 'Ohievych', '380982850534', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT27'), 'Andrei', 'Ohievych', '380987180209', 'worker');

-- MT29
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT29'), 'Serhii', 'Molchanovych', '48694689814', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT29'), 'MAKSYM', 'BANKOVSKYI', NULL, 'worker');

-- MT30
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT30'), 'Viacheslav', 'Turenko', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT30'), 'VIKTOR', 'PYSHNIAK', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT30'), 'Hennadii', 'Vyskub', '491781717571', 'worker');

-- MT31
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT31'), 'Artur', 'Korychak', '4916095040588', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT31'), 'Vadym', 'Kohut', '491751434266', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT31'), 'Taras', 'Kuzmych', '4915146680153', 'worker');

-- MT32
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT32'), 'OLEKSANDR', 'RUNKEVYCH', '380666159297', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT32'), 'EDUARD', 'PYSHNIK', '380666753539', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT32'), 'MYKOLA', 'PYSHNIAK', NULL, 'worker');

-- MT33
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT33'), 'Yevhenii', 'Ohiievych', '380682269772', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT33'), 'Oleh', 'Solovets', '380662337774', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT33'), 'Roman', 'Solovets', '380963637190', 'worker');

-- MT34
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT34'), 'Oleksandr', 'Yeremeichuk', '380973953617', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT34'), 'Pavlo', 'Kolodyuch', '380993463169', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT34'), 'Sergii', 'Volynets', '4915124195772', 'worker');

-- MT35
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT35'), 'Hryhorii', 'Moisiuk', '491748384907', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT35'), 'Bohdan', 'Vasyliv', '491748385123', 'worker');

-- MT36
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT36'), 'IVAN', 'TUSHYNSKYI', '380978073149', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT36'), 'LEONID', 'TUSHYNSKYI', '380931232390', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT36'), 'Vitalii', 'Poplavskyi', NULL, 'worker');

-- MT37
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT37'), 'MYKHAILO', 'DANYLIUK', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT37'), 'IVAN', 'BIBLIUK', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT37'), 'MYKOLA', 'HARAZDIUK', '4915770998446', 'worker');

-- MT38
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT38'), 'Serhii', 'Bulhak', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT38'), 'Mykyta', 'Zhulidov', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT38'), 'Serhii', 'Vostrak', '4915225758842', 'worker');

-- MT39
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT39'), 'Mykola', 'Baldych', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT39'), 'Mykola', 'Churylovych', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT39'), 'Ivan', 'Churylovych', '380983356760', 'worker');

-- MT40
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT40'), 'VITALII', 'MARYNYCH', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT40'), 'Volodymyr', 'MARYNYCH', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT40'), 'Vadym', 'Marynych', NULL, 'worker');

-- MT41
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT41'), 'Anatolii', 'Pavlovich', '380961287232', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT41'), 'Roman', 'Kosteniak', '380970150676', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT41'), 'Andrii', 'Diadiura', '380669626199', 'worker');

-- MT42
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT42'), 'ANDRII', 'OHIIEVYCH', '32465394336', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT42'), 'OLEKSANDR', 'OHIIEVYCH', '380970960886', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT42'), 'YURII', 'OHIIEVYCH', NULL, 'worker');

-- MT43
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT43'), 'Yaroslav', 'Kupchuk', '380982486504', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT43'), 'Oleh', 'Kuran', '380964486263', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT43'), 'Oleksandr', 'Kuran', '380972509776', 'worker');

-- MT44
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT44'), 'DMYTRO', 'VASYLEVYCH', '380982500738', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT44'), 'VADYM', 'VASYLEVYCH', '380981298145', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT44'), 'VASYL', 'DYFORT', NULL, 'worker');

-- MT45
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT45'), 'ROMAN', 'KOVALETS', '380687342590', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT45'), 'Taras', 'Balanovych', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT45'), 'Volodymyr', 'Kolodych', NULL, 'worker');

-- MT46
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT46'), 'Andrii', 'Abramchenko', '491747606664', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT46'), 'Andrii', 'DEREVIANKO', '380501414212', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT46'), 'Andrii', 'Samokhin', '380671702847', 'worker');

-- MT47
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT47'), 'Mykola', 'Lekhkobyt', '48884968303', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT47'), 'Petro', 'Hrechan', '380931946105', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT47'), 'Davyd', 'Kaliuta', NULL, 'worker');

-- MT48
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT48'), 'Vasyl', 'Khomiv', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT48'), 'Mykola', 'Khomiv', '491713462860', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT48'), 'Stanislav', 'Lytvynets', '380971580720', 'worker');

-- MT49
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT49'), 'Serhii', 'Kuzmenko', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT49'), 'Yurii', 'Lysenko', '48881398256', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT49'), 'Oleh', 'Babak', NULL, 'worker');

-- MT50
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT50'), 'MAKSYM', 'OHIIEVYCH', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT50'), 'MAKSYM', 'KRUPYCH', '380986030684', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT50'), 'SERHII', 'KRUPYCH', NULL, 'worker');

-- MT51
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT51'), 'Ivan', 'Mazur', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT51'), 'IHOR', 'MARYNYCH', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT51'), 'Petro', 'Rohulchyk', NULL, 'worker');

-- MT52
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT52'), 'Volodymyr', 'Zhabiuk', '380988996559', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT52'), 'Valentyn', 'Onchulenko', '380681901482', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT52'), 'PETRO', 'IKOBCHUK', '380678683066', 'worker');

-- MT53
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT53'), 'MYKHAILO', 'CHMUNEVYCH', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT53'), 'Petro', 'Chmunevych', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT53'), 'VASYL', 'CHMUNEVYCH', NULL, 'worker');

-- MT54
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT54'), 'Denys', 'Roslyi', '380639409044', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT54'), 'Serhii', 'Krynytskyi', '380502476198', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT54'), 'Bohdan', 'PEREKHODKO', NULL, 'worker');

-- MT55
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT55'), 'Viacheslav', 'Shkliaiev', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT55'), 'Sergej', 'Erler', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT55'), 'Wladislaw', 'Eichhorn', NULL, 'worker');

-- MT56
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT56'), 'Roman', 'Tymitskyi', '420725441649', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT56'), 'Serhii', 'Zhmurak', '380979140824', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT56'), 'Vladyslav', 'Bakunets', '380986228374', 'worker');

-- MT57
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT57'), 'Andrii', 'Velychko', '380984294440', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT57'), 'Vlad', 'Knevets', NULL, 'worker');

-- MT58
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT58'), 'Denys', 'Smyk', '380507234618', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT58'), 'Roman', 'Diadenchuk', '380973635787', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT58'), 'Maksym', 'Kravchuk', '380984308667', 'worker');

-- MT59
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT59'), 'Maksym', 'Yatsenko', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT59'), 'Petro', 'Verenko', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT59'), 'Serhii', 'Romanovych', NULL, 'worker');

-- MT60
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT60'), 'Roman', 'Ohiievych', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT60'), 'Dmytro', 'Vasylevych', '380987505699', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT60'), 'Roman', 'Ohiievych', NULL, 'worker');

-- MT61
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT61'), 'Yurii', 'Leskovets', '380983364390', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT61'), 'Denys', 'Panasiuk', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT61'), 'Denys', 'Chugay', '4915218871017', 'worker');

-- MT62
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT62'), 'Nazarii', 'Naumovich', '380970454659', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT62'), 'Nazar', 'Chuprun', '380678070817', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT62'), 'ANDRII', 'FRANTSEVYCH', '380684057442', 'worker');

-- MT64
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT64'), 'Antonas', 'Staniunas', '4917672264154', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT64'), 'Danylo', 'Rizopulo', '4915566537801', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT64'), 'Alexis', 'Erler', NULL, 'worker');

-- MT65
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT65'), 'MYKOLA', 'DROBUSH', '380982387942', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT65'), 'ANDRII', 'PYSHNIAK', NULL, 'worker');

-- MT66
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT66'), 'SERHII', 'OHIIEVYCH', '380982851175', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT66'), 'OLEKSANDR', 'OHIIEVYCH', '380983292765', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT66'), 'SERHII', 'OHIIEVYCH', '380688846256', 'worker');

-- MT67
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT67'), 'ANDRII', 'KRAVCHUK', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT67'), 'ANDRII', 'HAVRYLIUK', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT67'), 'Mykola', 'Zhabchyk', NULL, 'worker');

-- MT68
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT68'), 'Yevhen', 'Yanishevskyi', '4915116547619', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT68'), 'Hinnadii', 'Shyshlakov', '4916096517268', 'worker');

-- MT69
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT69'), 'Mykola', 'Krupych', '358465488579', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT69'), 'DMYTRO', 'YASKEVYCH', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT69'), 'SERHII', 'DYFORT', NULL, 'worker');

-- MT70
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT70'), 'Vitalii', 'Zavadskyi', '380668071904', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT70'), 'VIACHESLAV', 'ILIASHENKO', '380972747138', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT70'), 'Andrii', 'Zaitsev', '380985694882', 'worker');

-- MT71
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT71'), 'Yevhenii', 'Tolmachov', '491758711090', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT71'), 'Davyd', 'Kyliushyk', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT71'), 'Volodymyr', 'Kyliushyk', NULL, 'worker');

-- MT72
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT72'), 'Andrei', 'Coziruc', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT72'), 'Anatolii', 'Kukharuk', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT72'), 'Alexandr', 'Rabiciuc', '4915750014010', 'worker');

-- MT73
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT73'), 'Oleksandr', 'Lisovets', '380987502828', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT73'), 'Artur', 'Runkevych', '491604526595', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT73'), 'Vasyl', 'Ohiievych', '380676050416', 'worker');

-- MT74
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT74'), 'Rostyslav', 'Dovhaniuk', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT74'), 'Valentyn', 'Zhydetskyi', '4917672910907', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT74'), 'Oleksandr', 'Buha', NULL, 'worker');

-- MT75
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT75'), 'Mykola', 'Pavlovych', '380965379729', 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT75'), 'Vladyslav', 'Bortnyk', '380681522405', 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT75'), 'VITALII', 'OHIIEYCH', NULL, 'worker');

-- MT76
INSERT INTO crew_members (crew_id, first_name, last_name, phone, role) VALUES
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT76'), 'IVAN', 'MARIAN', NULL, 'leader'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT76'), 'NAZAR', 'HORBATIUK', NULL, 'worker'),
  ((SELECT id FROM crews WHERE firm_id = 1 AND unique_number = 'MT76'), 'IVAN', 'MARIAN', '380632627430', 'worker');

COMMIT;
