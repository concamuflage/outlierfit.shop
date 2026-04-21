package com.asianfit.ui.utils;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.SQLException;

public final class DatabaseCleanup {
  private DatabaseCleanup() {}

  public static void deleteSignupUser() {
    deleteUserByEmail(TestConfig.signupUserEmail());
  }

  public static void deleteTestUserCart() {
    deleteCartByUserEmail(TestConfig.testUserEmail());
  }

  public static void deleteUserByEmail(String email) {
    try (
      Connection connection = DriverManager.getConnection(
        TestConfig.databaseUrl(),
        TestConfig.databaseUser(),
        TestConfig.databasePassword()
      );
      PreparedStatement statement = connection.prepareStatement("DELETE FROM users WHERE email = ?")
    ) {
      statement.setString(1, email == null ? null : email.trim().toLowerCase());
      statement.executeUpdate();
    } catch (SQLException e) {
      throw new IllegalStateException("Failed to delete test user from database", e);
    }
  }

  public static void deleteCartByUserEmail(String email) {
    try (
      Connection connection = DriverManager.getConnection(
        TestConfig.databaseUrl(),
        TestConfig.databaseUser(),
        TestConfig.databasePassword()
      );
      PreparedStatement statement = connection.prepareStatement(
        """
          DELETE FROM carts
          WHERE user_id = (
            SELECT id
            FROM users
            WHERE email = ?
          )
        """
      )
    ) {
      statement.setString(1, email == null ? null : email.trim().toLowerCase());
      statement.executeUpdate();
    } catch (SQLException e) {
      throw new IllegalStateException("Failed to delete test user cart from database", e);
    }
  }
}
