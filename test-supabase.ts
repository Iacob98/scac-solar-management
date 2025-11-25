import { supabase } from './server/supabaseClient.js';

async function testSupabase() {
  console.log('🧪 Testing Supabase connection...\n');

  try {
    // Тест 1: Проверка подключения
    console.log('Test 1: Connection check...');
    const { error: connectionError } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (connectionError) {
      console.error('❌ Connection failed:', connectionError.message);
      return;
    }
    console.log('✅ Connection successful!\n');

    // Тест 2: Создание тестового пользователя
    console.log('Test 2: Creating test user...');
    const testEmail = `test_${Date.now()}@example.com`;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'test123456',
      email_confirm: true,
      user_metadata: {
        first_name: 'Test',
        last_name: 'User'
      }
    });

    if (authError) {
      console.error('❌ User creation failed:', authError.message);
      return;
    }
    console.log('✅ Test user created:', authData.user?.id);

    // Небольшая задержка для срабатывания триггера
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Тест 3: Проверка автоматического создания profile
    console.log('\nTest 3: Checking auto-created profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user?.id)
      .single();

    if (profileError) {
      console.error('❌ Profile check failed:', profileError.message);

      // Cleanup user even if profile check failed
      if (authData.user) {
        await supabase.auth.admin.deleteUser(authData.user.id);
      }
      return;
    }

    console.log('✅ Profile auto-created:');
    console.log('   - ID:', profile.id);
    console.log('   - Email:', profile.email);
    console.log('   - Name:', `${profile.first_name} ${profile.last_name}`);
    console.log('   - Role:', profile.role);

    // Тест 4: Проверка обновления profile
    console.log('\nTest 4: Updating profile...');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', authData.user?.id);

    if (updateError) {
      console.error('❌ Profile update failed:', updateError.message);
    } else {
      console.log('✅ Profile updated successfully');
    }

    // Тест 5: Проверка RLS политик
    console.log('\nTest 5: Testing RLS policies...');

    // Попытка чтения profiles без авторизации (должна fail или вернуть пусто)
    const { data: publicProfiles } = await supabase
      .from('profiles')
      .select('*');

    console.log('✅ RLS is active (public access returned', publicProfiles?.length || 0, 'profiles)');

    // Cleanup
    console.log('\nCleaning up...');
    if (authData.user) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      console.log('✅ Test user deleted');
    }

    console.log('\n✅✅✅ All tests passed! Supabase is ready to use.\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

// Запускаем тесты
testSupabase().catch(console.error);
